'use strict';

// QA: node --test scripts/test-migrations.cjs (Node >=22.13, sin dependencias nuevas).
// Ejecuta el módulo de producción contra SQLite real; no valida el puente Expo/APK.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { copyFileSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
const STOP = new Error('Fixture confirmado');
const FAILURE = new Error('Interrupción de migración');

function loadDatabase(adapter, platform = 'android') {
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename).exports;
    if (!compiled.has(filename)) {
      const source = readFileSync(filename, 'utf8');
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: filename,
      });
      compiled.set(filename, vm.runInThisContext(
        `(function(require, module, exports) { ${outputText}\n})`, { filename },
      ));
    }
    const module = { exports: {} };
    modules.set(filename, module);
    compiled.get(filename)((name) => {
      if (name === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
      if (name === 'react-native') return { Platform: { OS: platform } };
      if (name.startsWith('@/')) return load(path.join(root, 'src', `${name.slice(2)}.ts`));
      throw new Error(`Import inesperado en migraciones: ${name}`);
    }, module, module.exports);
    return module.exports;
  }
  return load(path.join(root, 'src/db/database.ts'));
}

// Separa sentencias, respetando literales SQL y comentarios. Esto permite cortar
// también ENTRE sentencias de un execAsync multilínea, como ocurre ante un crash.
function statements(sql) {
  const result = [];
  let start = 0;
  let quote = null;
  let comment = false;
  for (let i = 0; i < sql.length; i += 1) {
    if (comment) {
      if (sql[i] === '\n') comment = false;
    } else if (quote) {
      if (sql[i] === quote) {
        if (sql[i + 1] === quote) i += 1;
        else quote = null;
      }
    } else if (sql[i] === '-' && sql[i + 1] === '-') {
      comment = true;
      i += 1;
    } else if (sql[i] === "'" || sql[i] === '"') {
      quote = sql[i];
    } else if (sql[i] === ';') {
      result.push(sql.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  if (sql.slice(start).trim()) result.push(sql.slice(start).trim());
  return result;
}

function version(db) {
  return db.prepare('PRAGMA user_version').get().user_version;
}

function snapshot(db) {
  const schema = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type, name").all();
  const data = {};
  for (const table of db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all()) {
    assert.match(table.name, /^[a-z_]+$/);
    data[table.name] = db.prepare(`SELECT * FROM ${table.name} ORDER BY rowid`).all();
  }
  return JSON.parse(JSON.stringify({ version: version(db), schema, data }));
}

function adapterFor(db, options = {}) {
  let index = 0;
  let active = false;
  const trace = [];
  function boundary(phase, sql, position) {
    if (options.cut === position && options.phase === phase) {
      if (options.crash) process.exit(86); // Sin close/ROLLBACK: recuperación real del journal/WAL.
      throw FAILURE;
    }
  }
  async function execAsync(sql) {
    for (const statement of statements(sql)) {
      const position = index++;
      trace.push(statement);
      boundary('before', statement, position);
      db.exec(statement);
      if (statement === 'BEGIN') active = true;
      if (statement === 'COMMIT' || statement === 'ROLLBACK') active = false;
      boundary('after', statement, position);
      if (statement === 'COMMIT') options.onCommit?.(db);
    }
  }
  return {
    trace,
    execAsync,
    getFirstAsync: async (sql) => db.prepare(sql).get() ?? null,
    getAllAsync: async (sql) => db.prepare(sql).all(),
    withTransactionAsync: async (task) => {
      try {
        await execAsync('BEGIN');
        await task();
        await execAsync('COMMIT');
      } catch (error) {
        if (active) {
          db.exec('ROLLBACK');
          active = false;
        }
        throw error;
      }
    },
  };
}

async function migrate(db, options = {}, platform) {
  const adapter = adapterFor(db, options);
  const api = loadDatabase(adapter, platform);
  await api.initDatabase();
  assert.equal(api.getDb(), adapter);
  return adapter.trace;
}

async function createFixture(filename, target) {
  const db = new DatabaseSync(filename);
  try {
    if (target > 0) {
      await assert.rejects(migrate(db, {
        onCommit: (connection) => { if (version(connection) === target) throw STOP; },
      }), (error) => error === STOP);
    }
    if (target > 0) seed(db, target);
    assert.equal(version(db), target);
  } finally {
    db.close();
  }
}

function seed(db, v) {
  for (const [id, title, type] of [
    [101, 'Ana cumpleaños', 'cumpleanos'], [102, 'Mi cumpleaños', 'cumpleanos'],
    [103, 'Aniversario', 'aniversario'], [104, 'Reunión personalizada', v >= 11 ? 'custom' : 'evento'],
  ]) {
    db.prepare('INSERT INTO events (id, title, type, date, yearly, description) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, title, type, '2000-06-12', 1, 'Descripción original');
  }
  db.exec(`
    INSERT INTO notes VALUES (301, 'Nota histórica', 'Texto con ñ y ''comillas''', '2020-01-01', '2020-02-01');
    INSERT INTO settings VALUES ('display_name', 'Identidad existente');
    INSERT INTO settings VALUES ('theme', 'dark');
  `);
  if (v === 1) db.exec("UPDATE events SET reminder_minutes = 1440, notification_id = 'aviso-original' WHERE id = 101");
  else if (v === 2) {
    for (const [i, minutes] of [10080, 1440, 60, 7, 0].entries()) {
      db.prepare('INSERT INTO reminders VALUES (?, 101, ?, ?)').run(201 + i, minutes, `aviso-${i}`);
    }
  } else db.exec("INSERT INTO reminders VALUES (201, 101, 'aviso-original', 1, 'dias')");
  if (v >= 4) db.exec("UPDATE events SET contact_id = 'contacto-101', phone = '+5491111111111'");
  if (v >= 5) {
    db.exec(`
      UPDATE events SET is_mine = 1 WHERE id = 102;
      INSERT INTO greetings VALUES (401, 2026, 101, 'Ana', '+5491122222222', 1);
      INSERT INTO greetings VALUES (402, 2026, NULL, 'Vecino', NULL, 0);
    `);
  }
  if (v >= 7) db.exec(`
    INSERT INTO gift_ideas VALUES (501, 101, 'Regalo válido', '2020-01-01');
    INSERT INTO gift_ideas VALUES (502, 103, 'Capacidad no admitida en v13', '2020-01-01');
    INSERT INTO gift_ideas VALUES (503, 104, 'Regalo personalizado', '2020-01-01');
  `);
  if (v >= 8) db.exec(`
    INSERT INTO greetings_sent VALUES (601, 2026, 101, 1);
    INSERT INTO greetings_sent VALUES (602, 2026, 103, 1);
  `);
  if (v >= 9) db.exec("INSERT INTO tags VALUES (701, 'familia'); INSERT INTO event_tags VALUES (101, 701)");
  if (v >= 10) db.exec("UPDATE events SET photo_uri = 'file:///foto-preservada.jpg' WHERE id = 101");
  if (v >= 11) {
    db.exec("UPDATE event_types SET label = 'Etiqueta editada' WHERE key = 'cumpleanos'");
    if (v === 11) db.exec("INSERT INTO event_types VALUES (801, 'custom', 'Tipo propio', 'heart', '#123456', 1, 0)");
    else {
      db.exec(`
        INSERT INTO event_types (id, key, label, icon, color, default_yearly, is_builtin, base_key, extra_capabilities)
        VALUES (801, 'custom', 'Tipo propio', 'heart', '#123456', 1, 0, 'festivo', '["regalos","whatsapp","saludado"]');
        INSERT INTO custom_fields (id, type_id, label, kind) VALUES (901, 801, 'Dato propio', 'text');
        INSERT INTO event_field_values VALUES (104, 901, 'Valor original');
        INSERT INTO greetings_sent VALUES (603, 2026, 104, 1);
      `);
    }
  }
}

function assertPreserved(db, initialVersion) {
  assert.equal(version(db), 15);
  assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map((row) => row.integrity_check), ['ok']);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  if (initialVersion === 0) return;
  assert.deepEqual(db.prepare('SELECT id FROM events ORDER BY id').all().map((row) => row.id), [101, 102, 103, 104]);
  assert.equal(db.prepare("SELECT value FROM settings WHERE key = 'display_name'").get().value, 'Identidad existente');
  assert.equal(db.prepare('SELECT content FROM notes WHERE id = 301').get().content, "Texto con ñ y 'comillas'");
  assert.equal(db.prepare('SELECT title FROM events WHERE id = 101').get().title, 'Ana cumpleaños');
  assert.equal(db.prepare('SELECT date FROM events WHERE id = 101').get().date, '2000-06-12');
  if (initialVersion >= 4) {
    assert.equal(db.prepare('SELECT phone FROM events WHERE id = 101').get().phone, '+5491111111111');
    assert.equal(db.prepare('SELECT contact_id FROM events WHERE id = 103').get().contact_id, 'contacto-101');
    assert.equal(db.prepare('SELECT phone FROM events WHERE id = 103').get().phone, null);
  }
  if (initialVersion >= 5) {
    assert.equal(db.prepare('SELECT type FROM events WHERE id = 102').get().type, 'mi_cumpleanos');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM greetings').get().n, 2);
  }
  if (initialVersion >= 7) {
    assert.equal(db.prepare('SELECT text FROM gift_ideas WHERE id = 501').get().text, 'Regalo válido');
    assert.equal(db.prepare('SELECT id FROM gift_ideas WHERE id = 502').get(), undefined);
    if (initialVersion >= 11) assert.equal(db.prepare('SELECT id FROM gift_ideas WHERE id = 503').get().id, 503);
  }
  if (initialVersion >= 8) {
    assert.equal(db.prepare('SELECT greeted FROM greetings_sent WHERE id = 601').get().greeted, 1);
    assert.equal(db.prepare('SELECT id FROM greetings_sent WHERE id = 602').get(), undefined);
  }
  if (initialVersion >= 11) {
    assert.equal(db.prepare("SELECT label FROM event_types WHERE key = 'cumpleanos'").get().label, 'Etiqueta editada');
    assert.equal(db.prepare("SELECT id FROM event_types WHERE key = 'custom'").get().id, 801);
  }
  if (initialVersion === 12) {
    assert.equal(db.prepare('SELECT phone FROM events WHERE id = 104').get().phone, '+5491111111111');
    assert.equal(db.prepare('SELECT greeted FROM greetings_sent WHERE id = 603').get().greeted, 1);
    assert.equal(db.prepare('SELECT value FROM event_field_values WHERE field_id = 901').get().value, 'Valor original');
  }
  if (initialVersion === 2) assert.deepEqual(
    db.prepare('SELECT amount, unit FROM reminders ORDER BY id').all().map(({ amount, unit }) => [amount, unit]),
    [[1, 'semanas'], [1, 'dias'], [1, 'horas'], [7, 'minutos'], [0, 'minutos']],
  );
}

async function withDirectory(task) {
  const directory = mkdtempSync(path.join(tmpdir(), 'crono-migrations-'));
  try { await task(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

if (process.argv[2] === '--crash') {
  const [, , , filename, cut, phase] = process.argv;
  const db = new DatabaseSync(filename);
  migrate(db, { cut: Number(cut), phase, crash: true }).then(() => {
    db.close();
    process.exit(0);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else if (process.argv[2] === '--fixtures') {
  // Sólo QA en emulador descartable: no sobrescribe bases ni rutas del usuario.
  const directory = mkdtempSync(path.join(tmpdir(), 'crono-migration-fixtures-'));
  (async () => {
    for (let v = 0; v <= 12; v += 1) {
      await createFixture(path.join(directory, `v${v}.db`), v);
    }
    const partial = path.join(directory, 'legacy-v2-partial-v11.db');
    copyFileSync(path.join(directory, 'v11.db'), partial);
    const db = new DatabaseSync(partial);
    db.exec('PRAGMA user_version = 2');
    db.close();
    console.log(directory);
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  for (let v = 0; v <= 12; v += 1) {
    test(`v${v}: rollback y reapertura antes/después de cada sentencia y COMMIT`, async () => withDirectory(async (dir) => {
      const fixture = path.join(dir, 'fixture.db');
      await createFixture(fixture, v);
      const baselineFile = path.join(dir, 'baseline.db');
      copyFileSync(fixture, baselineFile);
      const baseline = new DatabaseSync(baselineFile);
      const checkpoints = new Map([[v, snapshot(baseline)]]);
      const trace = await migrate(baseline, { onCommit: (db) => checkpoints.set(version(db), snapshot(db)) });
      assertPreserved(baseline, v);
      const expected = snapshot(baseline);
      baseline.close();
      for (const phase of ['before', 'after']) {
        for (let cut = 0; cut < trace.length; cut += 1) {
          const filename = path.join(dir, `${phase}-${cut}.db`);
          copyFileSync(fixture, filename);
          let db = new DatabaseSync(filename);
          const adapter = adapterFor(db, { cut, phase });
          const api = loadDatabase(adapter);
          await assert.rejects(api.initDatabase(), (error) => error === FAILURE);
          assert.throws(() => api.getDb(), /no está inicializada/);
          assert.deepEqual(snapshot(db), checkpoints.get(version(db)), `v${v} ${phase} #${cut}: ${trace[cut]}`);
          db.close();
          db = new DatabaseSync(filename);
          await migrate(db);
          assert.deepEqual(snapshot(db), expected, `Reapertura v${v} ${phase} #${cut}`);
          assertPreserved(db, v);
          // Una segunda apertura no re-siembra tipos ni toca datos confirmados.
          await migrate(db);
          assert.deepEqual(snapshot(db), expected);
          db.close();
        }
      }
    }));
  }

  test('v2 histórica: cada prefijo no atómico hasta v11 se reanuda sin duplicar ni perder datos', async () => withDirectory(async (dir) => {
    const fixture = path.join(dir, 'fixture.db');
    await createFixture(fixture, 2);
    const baselineFile = path.join(dir, 'baseline.db');
    copyFileSync(fixture, baselineFile);
    const baseline = new DatabaseSync(baselineFile);
    const adapter = adapterFor(baseline, { onCommit: (db) => { if (version(db) === 11) throw STOP; } });
    await assert.rejects(loadDatabase(adapter).initDatabase(), (error) => error === STOP);
    const legacy = adapter.trace.filter((sql) => !/^(BEGIN|COMMIT|PRAGMA)/.test(sql));
    await migrate(baseline);
    const expected = snapshot(baseline);
    baseline.close();
    for (let prefix = 1; prefix <= legacy.length; prefix += 1) {
      const filename = path.join(dir, `partial-${prefix}.db`);
      copyFileSync(fixture, filename);
      const db = new DatabaseSync(filename);
      db.exec('PRAGMA foreign_keys = ON');
      for (const sql of legacy.slice(0, prefix)) db.exec(sql);
      assert.equal(version(db), 2);
      await migrate(db);
      assertPreserved(db, 2);
      assert.deepEqual(snapshot(db), expected, `Prefijo legacy ${prefix}: ${legacy[prefix - 1]}`);
      db.close();
    }
  }));

  test('cierre abrupto de proceso: antes de BEGIN, dentro de DDL/backfill y después de COMMIT legacy', async () => withDirectory(async (dir) => {
    for (let v = 0; v <= 10; v += 1) {
      const fixture = path.join(dir, `fixture-${v}.db`);
      await createFixture(fixture, v);
      const baselineFile = path.join(dir, `baseline-${v}.db`);
      copyFileSync(fixture, baselineFile);
      const baseline = new DatabaseSync(baselineFile);
      const checkpoints = new Map([[v, snapshot(baseline)]]);
      const trace = await migrate(baseline, { onCommit: (db) => checkpoints.set(version(db), snapshot(db)) });
      const expected = snapshot(baseline);
      baseline.close();
      const begin = trace.indexOf('BEGIN');
      const commit = trace.indexOf('COMMIT');
      for (const [label, cut, phase] of [
        ['antes', begin, 'before'], ['durante', begin + 1, 'after'], ['después', commit, 'after'],
      ]) {
        const filename = path.join(dir, `crash-${v}-${label}.db`);
        copyFileSync(fixture, filename);
        const child = spawnSync(process.execPath, [__filename, '--crash', filename, String(cut), phase], { encoding: 'utf8' });
        assert.equal(child.status, 86, child.stderr || String(child.error));
        const db = new DatabaseSync(filename);
        assert.deepEqual(snapshot(db), checkpoints.get(version(db)), `Crash v${v} ${label}`);
        await migrate(db);
        assert.deepEqual(snapshot(db), expected);
        assertPreserved(db, v);
        db.close();
      }
    }
  }));

  test('v0 histórica con tablas y datos ya creados no reinstala ni pierde identidad', async () => withDirectory(async (dir) => {
    const filename = path.join(dir, 'partial-v0.db');
    await createFixture(filename, 1);
    const db = new DatabaseSync(filename);
    db.exec('PRAGMA user_version = 0');
    await migrate(db);
    assertPreserved(db, 1);
    db.close();
  }));

  test('backend web: no cambia WAL y usa las mismas transacciones reanudables', async () => withDirectory(async (dir) => {
    const db = new DatabaseSync(path.join(dir, 'web.db'));
    const trace = await migrate(db, {}, 'web');
    assert.equal(trace.some((sql) => sql.includes('journal_mode')), false);
    assert.equal(trace.filter((sql) => sql === 'COMMIT').length, 15);
    assertPreserved(db, 0);
    db.close();
  }));
}
