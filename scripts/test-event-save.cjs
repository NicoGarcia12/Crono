'use strict';

// QA: node --test scripts/test-event-save.cjs (Node >=22.13).
// SQLite y Redux son reales; sólo el puente Expo y el scheduler nativo se sustituyen.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { configureStore } = require('@reduxjs/toolkit');

const root = path.resolve(__dirname, '..');
const compiled = new Map();
const failure = new Error('Interrupción entre escrituras del evento');
const scheduled = [
  { amount: 1, unit: 'dias', notificationId: 'nuevo-1' },
  { amount: 2, unit: 'horas', notificationId: 'nuevo-2' },
];

function loadModules(adapter, platform) {
  const modules = new Map();
  function load(name) {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
    if (name === '@/notifications/notifications') {
      return { scheduleEventReminders: async () => scheduled, cancelReminders: async () => {} };
    }
    if (!name.startsWith('@/')) return require(name);
    const filename = path.join(root, 'src', `${name.slice(2)}.ts`);
    if (modules.has(filename)) return modules.get(filename).exports;
    if (!compiled.has(filename)) {
      const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: filename,
      });
      compiled.set(filename, vm.runInThisContext(
        `(function(require, module, exports) { ${outputText}\n})`, { filename },
      ));
    }
    const module = { exports: {} };
    modules.set(filename, module);
    compiled.get(filename)(load, module, module.exports);
    return module.exports;
  }
  return load;
}

function adapterFor(db) {
  let active = false;
  let cut = null;
  let writes = 0;
  let exclusiveCalls = 0;
  let regularCalls = 0;
  let pause = null;
  const params = (args) => args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  const executor = {
    runAsync: async (sql, ...args) => {
      assert.equal(active, true, 'una escritura del agregado escapó de su transacción');
      const result = db.prepare(sql).run(...params(args));
      const position = ++writes;
      if (pause?.position === position) {
        const waiting = pause;
        pause = null;
        waiting.enter();
        await waiting.resume;
      }
      if (position === cut) {
        cut = null;
        throw failure; // Se corta DESPUÉS de escribir para demostrar rollback real.
      }
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...params(args)) ?? null,
    getAllAsync: async (sql, ...args) => db.prepare(sql).all(...params(args)),
  };
  async function transaction(task, exclusive) {
    assert.equal(active, false, 'no se permiten transacciones anidadas');
    db.exec('BEGIN');
    active = true;
    try {
      await (exclusive ? task(executor) : task());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      active = false;
    }
  }
  const adapter = {
    ...executor,
    execAsync: async (sql) => db.exec(sql),
    withTransactionAsync: async (task) => {
      regularCalls += 1;
      return transaction(task, false);
    },
    withExclusiveTransactionAsync: async (task) => {
      exclusiveCalls += 1;
      return transaction(task, true);
    },
  };
  return {
    adapter,
    reset: (position = null) => { writes = 0; cut = position; exclusiveCalls = 0; regularCalls = 0; },
    pauseAfterWrite: (position) => {
      let enter;
      let release;
      const entered = new Promise((resolve) => { enter = resolve; });
      const resume = new Promise((resolve) => { release = resolve; });
      pause = { position, enter, resume };
      return { entered, release };
    },
    state: () => ({ active, writes, exclusiveCalls, regularCalls }),
  };
}

const original = {
  title: 'Evento propio', type: 'custom', date: '2000-02-29', time: '16:30',
  description: 'Descripción válida', yearly: 1, contactId: 'contacto-1',
  phone: '+5491112345678', isMine: 0, photoUri: 'file:///foto.jpg', yearUnknown: 1,
  reminders: [{ amount: 1, unit: 'dias' }], tags: ['Original'],
  fieldValues: { 901: '  Texto con ñ  ', 902: '["Agua","Pelota"]', 903: '0' },
};
const changed = {
  ...original, title: 'Editado', tags: ['Nueva', 'Otra'],
  fieldValues: { 901: 'Nuevo', 902: '["Pelota"]', 903: '-12,5', 904: '   ' },
};

function snapshot(db) {
  const data = {};
  for (const { name } of db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all()) {
    assert.match(name, /^[a-z_]+$/);
    data[name] = db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all();
  }
  return JSON.parse(JSON.stringify(data));
}

async function fixture(platform) {
  const db = new DatabaseSync(':memory:');
  const control = adapterFor(db);
  const load = loadModules(control.adapter, platform);
  await load('@/db/database').initDatabase();
  db.exec(`
    INSERT INTO event_types (id, key, label, icon, color, default_yearly, is_builtin, base_key, extra_capabilities)
    VALUES (801, 'custom', 'Propio', 'heart', '#123456', 1, 0, 'cumpleanos', '["regalos","whatsapp","saludado"]');
    INSERT INTO custom_fields (id, type_id, label, kind) VALUES (901, 801, 'Texto', 'texto');
    INSERT INTO custom_fields (id, type_id, label, kind, options) VALUES (902, 801, 'Multi', 'multi', '["Agua","Pelota"]');
    INSERT INTO custom_fields (id, type_id, label, kind) VALUES (903, 801, 'Número', 'numero');
    INSERT INTO custom_fields (id, type_id, label, kind) VALUES (904, 801, 'Opcional', 'texto');
  `);
  const actions = load('@/store/events-slice');
  const fields = load('@/store/field-values-slice');
  const repo = load('@/db/events-repo');
  const first = await repo.insertEvent(original, [{ amount: 1, unit: 'dias', notificationId: 'anterior' }]);
  db.prepare('INSERT INTO gift_ideas (event_id, text, created_at) VALUES (?, ?, ?)').run(first.id, 'Regalo válido', '2026-01-01');
  db.prepare('INSERT INTO greetings_sent (year, event_id, greeted) VALUES (?, ?, 1)').run(2026, first.id);
  db.prepare('INSERT INTO greetings (year, event_id, name, phone, greeted) VALUES (?, ?, ?, ?, 1)').run(2026, first.id, 'Ana', original.phone);
  const store = configureStore({ reducer: { events: actions.default, fieldValues: fields.default } });
  await store.dispatch(actions.loadEvents()).unwrap();
  await store.dispatch(fields.loadFieldValues()).unwrap();
  control.reset();
  return { db, control, store, actions, fields, first, repo, load };
}

function save(f, mode, data = changed) {
  return mode === 'crear'
    ? f.store.dispatch(f.actions.addEvent(data)).unwrap()
    : f.store.dispatch(f.actions.editEvent({ id: f.first.id, data, previousReminders: f.first.reminders })).unwrap();
}

for (const platform of ['android', 'web']) {
  for (const mode of ['crear', 'editar']) {
    test(`${platform}: ${mode} revierte cada frontera de escritura y reintenta sin duplicados`, async (t) => {
      const baseline = await fixture(platform);
      let total;
      try {
        await save(baseline, mode);
        total = baseline.control.state().writes;
        assert.ok(total >= 10, 'se ejercitan evento, avisos, tags y campos');
      } finally { baseline.db.close(); }
      for (let cut = 1; cut <= total; cut += 1) {
        await t.test(`fallo después de escritura ${cut}/${total}`, async () => {
          const f = await fixture(platform);
          try {
            const beforeDb = snapshot(f.db);
            const beforeStore = f.store.getState();
            f.control.reset(cut);
            await assert.rejects(save(f, mode), { message: failure.message });
            assert.deepEqual(snapshot(f.db), beforeDb);
            assert.deepEqual(f.store.getState(), beforeStore);
            assert.equal(f.control.state().active, false);
            // Si quedó una transacción abierta, este BEGIN falla antes del reintento.
            f.db.exec('BEGIN; ROLLBACK');
            f.control.reset();
            const persisted = await save(f, mode);
            assert.equal(f.control.state().active, false);
            assert.equal(f.control.state().exclusiveCalls, platform === 'web' ? 0 : 1);
            assert.equal(f.control.state().regularCalls, platform === 'web' ? 1 : 0);
            assert.equal(f.store.getState().events.items.length, mode === 'crear' ? 2 : 1);
            assert.deepEqual(f.store.getState().fieldValues.byEvent[persisted.id], {
              901: 'Nuevo', 902: '["Pelota"]', 903: '-12,5',
            });
            const loaded = await f.repo.findAllEvents();
            assert.deepEqual(loaded.find((event) => event.id === persisted.id), persisted);
            assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM reminders WHERE event_id = ?').get(persisted.id).n, 2);
            assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM event_tags WHERE event_id = ?').get(persisted.id).n, 2);
            assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM event_field_values WHERE event_id = ?').get(persisted.id).n, 3);
            const values = await f.load('@/db/custom-fields-repo').findAllFieldValues();
            assert.deepEqual(values[persisted.id], f.store.getState().fieldValues.byEvent[persisted.id]);
            for (const table of ['gift_ideas', 'greetings_sent', 'greetings']) {
              assert.deepEqual(snapshot(f.db)[table], beforeDb[table], `capacidad válida ${table}`);
            }
            assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(), []);
          } finally { f.db.close(); }
        });
      }
    });
  }

  test(`${platform}: campos omitidos se conservan y {} elimina explícitamente`, async () => {
    const f = await fixture(platform);
    try {
      const { fieldValues, ...withoutFields } = changed;
      await save(f, 'editar', withoutFields);
      assert.deepEqual(f.store.getState().fieldValues.byEvent[f.first.id], original.fieldValues);
      assert.deepEqual(await f.load('@/db/custom-fields-repo').findAllFieldValues(), { [f.first.id]: original.fieldValues });
      await save(f, 'editar', { ...withoutFields, fieldValues: {} });
      assert.deepEqual(f.store.getState().fieldValues.byEvent[f.first.id], {});
      assert.deepEqual(await f.load('@/db/custom-fields-repo').findAllFieldValues(), {});
    } finally { f.db.close(); }
  });

  test(`${platform}: cumpleaños propio se revierte junto con sus relaciones`, async () => {
    const f = await fixture(platform);
    try {
      const mine = { ...original, isMine: 1, tags: [], fieldValues: undefined };
      const previous = await f.repo.insertEvent(mine, []);
      const before = snapshot(f.db);
      f.control.reset(3); // clearMine, INSERT evento, primer INSERT de reminder.
      await assert.rejects(f.repo.insertEvent(mine, scheduled), { message: failure.message });
      assert.deepEqual(snapshot(f.db), before);
      assert.equal(f.db.prepare('SELECT is_mine FROM events WHERE id = ?').get(previous.id).is_mine, 1);
      f.control.reset();
      await Promise.all([f.repo.insertEvent(mine, []), f.repo.insertEvent(mine, [])]);
      assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM events WHERE is_mine = 1').get().n, 1);
      assert.equal(f.control.state().active, false);
    } finally { f.db.close(); }
  });

  test(`${platform}: completar campos usa una única transacción sin perder otros datos`, async () => {
    const f = await fixture(platform);
    try {
      const before = snapshot(f.db);
      f.control.reset(2);
      await assert.rejects(f.store.dispatch(f.fields.saveFieldValues({
        eventId: f.first.id, values: changed.fieldValues,
      })).unwrap(), { message: failure.message });
      assert.deepEqual(snapshot(f.db), before);
      assert.deepEqual(f.store.getState().fieldValues.byEvent[f.first.id], original.fieldValues);
      f.control.reset();
      await f.store.dispatch(f.fields.saveFieldValues({ eventId: f.first.id, values: changed.fieldValues })).unwrap();
      assert.equal(f.control.state().active, false);
    } finally { f.db.close(); }
  });

  test(`${platform}: editar un evento inexistente no confirma relaciones ni cambia el cumpleaños propio`, async () => {
    const f = await fixture(platform);
    try {
      const mine = { ...original, isMine: 1, tags: [], fieldValues: undefined };
      await f.repo.insertEvent(mine, []);
      const before = snapshot(f.db);
      await assert.rejects(f.repo.updateEvent(9999, mine, scheduled), { message: 'El evento ya no existe.' });
      assert.deepEqual(snapshot(f.db), before);
      assert.equal(f.control.state().active, false);
    } finally { f.db.close(); }
  });

  test(`${platform}: el borrado espera al guardado fallido y confirma independientemente`, async () => {
    const f = await fixture(platform);
    try {
      f.control.reset(1);
      const gate = f.control.pauseAfterWrite(1);
      const saving = f.store.dispatch(f.actions.addEvent(changed));
      await gate.entered;

      // Se pide borrar mientras el INSERT del nuevo evento sigue dentro de BEGIN.
      // La pausa es en el adaptador, no reemplaza la lógica del repositorio.
      let deleted = false;
      const removing = f.store.dispatch(f.actions.removeEvent(f.first));
      void removing.then(() => { deleted = true; });
      await new Promise((resolve) => setImmediate(resolve));
      const confirmedInsideSave = deleted;
      gate.release();

      const saved = await saving;
      assert.equal(saved.type, f.actions.addEvent.rejected.type);
      await removing.unwrap();
      assert.equal(confirmedInsideSave, false, 'el DELETE no puede confirmar dentro de otro guardado');
      assert.deepEqual(await f.repo.findAllEvents(), []);
      assert.deepEqual(f.store.getState().events.items, []);
      assert.deepEqual(await f.load('@/db/custom-fields-repo').findAllFieldValues(), {});
      assert.deepEqual(f.store.getState().fieldValues.byEvent, {});
      assert.equal(f.control.state().active, false);
      f.db.exec('BEGIN; ROLLBACK');
      await f.store.dispatch(f.actions.loadEvents()).unwrap();
      assert.deepEqual(f.store.getState().events.items, [], 'el evento borrado no reaparece al recargar');
    } finally { f.db.close(); }
  });

  test(`${platform}: Redux y SQLite conservan un único cumpleaños propio al crear y editar`, async () => {
    const f = await fixture(platform);
    try {
      const mine = { ...original, isMine: 1, tags: [], fieldValues: undefined };
      const previous = await f.store.dispatch(f.actions.addEvent(mine)).unwrap();
      const before = f.store.getState();
      f.control.reset(3);
      await assert.rejects(f.store.dispatch(f.actions.addEvent({
        ...mine, title: 'No confirmado',
      })).unwrap(), { message: failure.message });
      assert.deepEqual(f.store.getState(), before, 'un rechazo no cambia el cumpleaños propio anterior');

      f.control.reset();
      const replacement = await f.store.dispatch(f.actions.addEvent({
        ...mine, title: 'Otro cumpleaños propio',
      })).unwrap();
      const mineIds = (events) => events.filter((event) => event.isMine === 1).map((event) => event.id);
      assert.deepEqual(mineIds(f.store.getState().events.items), [replacement.id]);
      assert.deepEqual(mineIds(await f.repo.findAllEvents()), [replacement.id]);

      await f.store.dispatch(f.actions.editEvent({
        id: previous.id, data: mine, previousReminders: previous.reminders,
      })).unwrap();
      assert.deepEqual(mineIds(f.store.getState().events.items), [previous.id]);
      assert.deepEqual(mineIds(await f.repo.findAllEvents()), [previous.id]);
      assert.equal(f.control.state().active, false);
    } finally { f.db.close(); }
  });
}
