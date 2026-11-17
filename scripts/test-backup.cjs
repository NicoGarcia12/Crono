'use strict';

// QA: node --test scripts/test-backup.cjs (Node >=22.13).
// SQLite (node:sqlite) y Redux son reales y se ejecutan las funciones de producción
// (exportBackup / restoreBackup / repos). Solo se sustituyen los bordes: el puente
// expo-sqlite (un adaptador con la misma semántica de BEGIN/COMMIT/ROLLBACK que
// expo-sqlite 57), el selector de archivos y el scheduler nativo de avisos.
// Limitaciones: no valida el puente nativo/APK. En el modo "android" la transacción
// exclusiva comparte la conexión del adaptador (igual que test-event-save.cjs); la
// conexión separada real de Expo no se emula. Todos los datos son sintéticos.
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
const FAILURE = new Error('Interrupción entre escrituras de la restauración');

function loadModules(adapter, platform, bridge) {
  const modules = new Map();
  function load(name) {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
    if (name === '@/notifications/notifications') {
      return { scheduleEventReminders: bridge.schedule, cancelReminders: bridge.cancel };
    }
    if (name === '@/backup/file-io') return { pickTextFile: bridge.pick, saveAndShare: bridge.save };
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

/**
 * Adaptador con la semántica de expo-sqlite: `withTransactionAsync` hace
 * BEGIN/COMMIT y, ante un error, ROLLBACK (aunque el BEGIN haya fallado). No hay
 * ningún `assert` de anidamiento: si dos transacciones se superponen, SQLite real
 * devuelve "cannot start a transaction within a transaction".
 */
function adapterFor(db, platform) {
  const state = { active: false, strict: false, writes: 0, cut: null, exclusive: 0, regular: 0, pause: null, onBegin: null };
  const params = (args) => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
  const executor = {
    runAsync: async (sql, ...args) => {
      if (state.strict) assert.equal(state.active, true, `escritura fuera de la transacción: ${sql}`);
      const result = db.prepare(sql).run(...params(args));
      if (state.active) {
        state.writes += 1;
        if (state.pause?.write === state.writes) {
          const pause = state.pause;
          state.pause = null;
          pause.entered();
          await pause.gate;
        }
        if (state.cut === state.writes) {
          state.cut = null;
          throw FAILURE; // Se corta DESPUÉS de escribir para demostrar rollback real.
        }
      }
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...params(args)) ?? null,
    getAllAsync: async (sql, ...args) => db.prepare(sql).all(...params(args)),
  };
  async function transaction(task, exclusive) {
    // En nativo la transacción exclusiva abre una conexión NUEVA: SQLite arranca con foreign_keys APAGADO
    // en cada conexión, así que ahí no hay ON DELETE CASCADE salvo que el código borre explícitamente.
    // (El PRAGMA no cambia dentro de una transacción: se alterna antes del BEGIN y se restaura al final.)
    const separateConnection = exclusive && platform !== 'web';
    try {
      if (separateConnection) db.exec('PRAGMA foreign_keys = OFF');
      db.exec('BEGIN');
      state.active = true;
      if (state.onBegin) {
        const onBegin = state.onBegin;
        state.onBegin = null;
        onBegin();
      }
      await (exclusive ? task(executor) : task());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      state.active = false;
      if (separateConnection) db.exec('PRAGMA foreign_keys = ON');
    }
  }
  const adapter = {
    ...executor,
    execAsync: async (sql) => db.exec(sql),
    withTransactionAsync: async (task) => {
      state.regular += 1;
      return transaction(task, false);
    },
    withExclusiveTransactionAsync: async (task) => {
      if (platform === 'web') throw new Error('withExclusiveTransactionAsync is not supported on web');
      state.exclusive += 1;
      return transaction(task, true);
    },
  };
  return {
    adapter,
    state,
    reset: (cut = null) => { state.writes = 0; state.cut = cut; state.exclusive = 0; state.regular = 0; },
    pauseAfterWrite(write) {
      let entered;
      let release;
      const reached = new Promise((resolve) => { entered = resolve; });
      const gate = new Promise((resolve) => { release = resolve; });
      state.pause = { write, entered, gate };
      return { reached, release };
    },
  };
}

const original = {
  title: 'Evento base', type: 'evento', date: '2026-01-01', time: null, description: null,
  contactId: null, phone: null, reminders: [], yearly: 0, isMine: 0, tags: [],
  photoUri: null, yearUnknown: 0,
};

/** Un "celular": SQLite en memoria + Redux reales; avisos y archivos simulados. */
async function device(platform) {
  const db = new DatabaseSync(':memory:');
  const control = adapterFor(db, platform);
  // `hold`: promesa que el scheduler espera antes de programar (para forzar carreras entre restauraciones).
  const notifier = { next: 1, active: new Set(), calls: 0, failOn: null, hold: null, failCancelIds: new Set() };
  const files = { picked: null, saved: null };
  const bridge = {
    schedule: async (event) => {
      notifier.calls += 1;
      if (notifier.hold) await notifier.hold;
      if (notifier.failOn === notifier.calls) throw new Error('El sistema rechazó programar el aviso');
      return event.reminders.map((reminder) => {
        const notificationId = `aviso-${notifier.next++}`;
        notifier.active.add(notificationId);
        return { ...reminder, notificationId };
      });
    },
    cancel: async (reminders) => {
      const attempts = await Promise.allSettled(reminders.map(async ({ notificationId }) => {
        if (notifier.failCancelIds.has(notificationId)) throw new Error(`El SO no pudo cancelar ${notificationId}`);
        if (notificationId) notifier.active.delete(notificationId);
      }));
      const failed = attempts.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
    },
    pick: async () => files.picked,
    save: async (_name, content) => { files.saved = content; },
  };
  const load = loadModules(control.adapter, platform, bridge);
  await load('@/db/database').initDatabase();
  const S = {
    events: load('@/store/events-slice'),
    bases: load('@/store/event-bases-slice'),
    types: load('@/store/event-types-slice'),
    values: load('@/store/field-values-slice'),
    notes: load('@/store/notes-slice'),
    settings: load('@/store/settings-slice'),
    greetings: load('@/store/greetings-slice'),
    sent: load('@/store/greetings-sent-slice'),
    backup: load('@/store/backup-slice'),
  };
  const store = configureStore({
    reducer: {
      events: S.events.default,
      eventBases: S.bases.default,
      eventTypes: S.types.default,
      fieldValues: S.values.default,
      giftIdeas: load('@/store/gift-ideas-slice').default,
      greetings: S.greetings.default,
      greetingsSent: S.sent.default,
      notes: S.notes.default,
      settings: S.settings.default,
    },
  });
  const d = {
    db, control, notifier, files, load, S, store, platform,
    repos: {
      events: load('@/db/events-repo'),
      eventTypes: load('@/db/event-types-repo'),
      eventBases: load('@/db/event-bases-repo'),
      greetings: load('@/db/greetings-repo'),
      sent: load('@/db/greetings-sent-repo'),
      settings: load('@/db/settings-repo'),
      backup: load('@/db/backup-repo'),
    },
    async reloadAll() {
      for (const action of [
        S.events.loadEvents(), S.bases.loadEventBases(), S.types.loadEventTypes(),
        S.values.loadFieldValues(), S.notes.loadNotes(), S.settings.loadSettings(),
      ]) await store.dispatch(action).unwrap();
    },
    async restore(raw) {
      files.picked = raw;
      return store.dispatch(S.backup.restoreBackup()).unwrap();
    },
    async exportFile() {
      await store.dispatch(S.backup.exportBackup()).unwrap();
      return files.saved;
    },
    openTransaction() {
      // Si quedó una transacción abierta, este BEGIN falla.
      db.exec('BEGIN; ROLLBACK');
      return false;
    },
  };
  await d.reloadAll();
  control.reset();
  return d;
}

function snapshot(db) {
  const data = {};
  for (const { name } of db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all()) {
    assert.match(name, /^[a-z_]+$/);
    data[name] = db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all();
  }
  return JSON.parse(JSON.stringify(data));
}

/** Contenido de la agenda sin ids locales ni ids de notificación (comparable entre celulares). */
function semantic(db) {
  const q = (sql) => JSON.parse(JSON.stringify(db.prepare(sql).all()));
  return {
    displayName: q("SELECT value FROM settings WHERE key = 'displayName'"),
    events: q(`
      SELECT e.title, e.type, e.date, e.time, e.description, e.yearly, e.contact_id AS contactId, e.phone,
             e.is_mine AS isMine, e.year_unknown AS yearUnknown,
             (SELECT group_concat(name, '|') FROM (SELECT t.name FROM event_tags et JOIN tags t ON t.id = et.tag_id
                WHERE et.event_id = e.id ORDER BY t.name)) AS tags,
             (SELECT group_concat(amount || unit, '|') FROM (SELECT amount, unit FROM reminders r
                WHERE r.event_id = e.id ORDER BY r.id)) AS reminders,
             (SELECT group_concat(label || '=' || value, '|') FROM (SELECT f.label AS label, v.value AS value
                FROM event_field_values v JOIN custom_fields f ON f.id = v.field_id
                WHERE v.event_id = e.id ORDER BY f.label)) AS fields
      FROM events e ORDER BY e.title, e.date, e.id`),
    greetings: q(`
      SELECT g.year, g.name, g.phone, g.greeted, e.title AS eventTitle
      FROM greetings g LEFT JOIN events e ON e.id = g.event_id ORDER BY g.year, g.name, g.id`),
    sent: q(`
      SELECT s.year, s.greeted, e.title AS eventTitle
      FROM greetings_sent s JOIN events e ON e.id = s.event_id ORDER BY s.year, e.title, s.id`),
    notes: q('SELECT title, content FROM notes ORDER BY title'),
    bases: q('SELECT key, label, yearly, requires_time, capabilities, is_builtin FROM event_bases ORDER BY key'),
    types: q(`SELECT key, label, icon, color, default_yearly, is_builtin, base_key, extra_capabilities, hidden
              FROM event_types ORDER BY key`),
    fields: q(`
      SELECT COALESCE(b.key, t.key) AS owner, f.base_id IS NOT NULL AS isBase, f.label, f.kind, f.options,
             f.position, f.required
      FROM custom_fields f LEFT JOIN event_bases b ON b.id = f.base_id LEFT JOIN event_types t ON t.id = f.type_id
      ORDER BY owner, f.position`),
  };
}

const NO_PLAN = { capabilities: [], fieldIds: [], options: [] };

/** Agenda de origen 100% sintética, creada con las funciones de producción. */
async function seedSource(d) {
  const { repos, S, store } = d;
  await repos.settings.setSetting('displayName', 'Persona Sintética');
  const base = await repos.eventBases.createEventBase({
    label: 'Mascota', yearly: true, requiresTime: false, capabilities: ['edad'],
    fields: [{ label: 'Especie', kind: 'select', options: ['Perro', 'Gato'], required: true }],
  });
  await repos.eventTypes.createEventType({
    label: 'Firulais', icon: 'paw', color: '#795548', baseKey: base.key,
    extraCapabilities: ['regalos', 'saludado'],
    fields: [{ label: 'Juguetes', kind: 'multi', options: ['Pelota', 'Hueso'], required: false }],
  });
  // Personalización de un tipo de fábrica (lo único que el usuario puede cambiar de él).
  const [birthdayType] = (await repos.eventTypes.findAllEventTypes()).filter((t) => t.key === 'cumpleanos');
  await repos.eventTypes.updateEventType(
    birthdayType.id,
    { label: 'Cumples', icon: 'balloon', color: '#112233', baseKey: 'cumpleanos', extraCapabilities: [], fields: [] },
    NO_PLAN,
  );
  await d.reloadAll();

  const fields = store.getState().eventBases.fields;
  const fieldId = (label) => fields.find((f) => f.label === label).id;
  const add = (data) => store.dispatch(S.events.addEvent({ ...original, ...data })).unwrap();
  const mine = await add({
    title: 'Mi cumple sintético', type: 'mi_cumpleanos', date: '1990-05-05', yearly: 1, isMine: 1,
    reminders: [{ amount: 1, unit: 'dias' }],
  });
  const ana = await add({
    title: 'Ana Prueba', type: 'cumpleanos', date: '1980-03-03', yearly: 1, tags: ['familia', 'amigos'],
    phone: '+54 11 5555-0001', contactId: 'contacto-sintetico-1',
    reminders: [{ amount: 1, unit: 'dias' }, { amount: 2, unit: 'horas' }],
  });
  const luna = await add({
    title: 'Luna', type: 'firulais', date: '2020-02-29', yearly: 1, yearUnknown: 1,
    fieldValues: { [fieldId('Especie')]: 'Gato', [fieldId('Juguetes')]: '["Pelota"]' },
  });
  await add({
    title: 'Reunión', date: '2026-12-01', time: '10:30', description: 'Sin datos reales',
    reminders: [{ amount: 1, unit: 'dias' }], photoUri: 'file:///foto-sintetica.jpg',
  });
  await add({ title: 'Duplicado', type: 'cumpleanos', date: '2001-01-01', yearly: 1 });
  await add({ title: 'Duplicado', type: 'cumpleanos', date: '2001-01-01', yearly: 1 });
  await d.db.prepare('INSERT INTO gift_ideas (event_id, text, created_at) VALUES (?, ?, ?)')
    .run(ana.id, 'Idea sintética', '2026-01-01');
  await store.dispatch(S.notes.addNote({ title: 'Nota uno', content: 'Contenido uno' })).unwrap();
  await store.dispatch(S.notes.addNote({ title: 'Nota dos', content: 'Contenido dos' })).unwrap();

  // Saludos de VARIOS años, enlazados y sueltos; nunca se visita la pantalla de saludos.
  const { greetings, sent } = repos;
  await greetings.insertGuest(2023, 'Invitado Dos', null, true);
  await greetings.setGreetedForEvent(2024, ana.id, 'Ana Prueba', '+54 11 5555-0001', true);
  await greetings.setGreetedForEvent(2025, ana.id, 'Ana Prueba', '+54 11 5555-0001', false);
  await greetings.insertGuest(2025, 'Invitado Uno', '+54 11 5555-0002', true);
  await greetings.insertGuest(2025, 'Invitado Uno', '+54 11 5555-0002', true); // repetido a propósito
  await sent.setGreetingSent(2024, ana.id, true);
  await sent.setGreetingSent(2025, ana.id, true);
  await sent.setGreetingSent(2025, luna.id, true);
  return { mine, ana, luna };
}

/** Datos propios de un celular que ya se usa (para probar que lo previo no se pierde). */
async function seedLocal(d) {
  await d.store.dispatch(d.S.events.addEvent({
    ...original, title: 'Evento local', date: '2027-01-01', reminders: [{ amount: 3, unit: 'dias' }], tags: ['local'],
  })).unwrap();
  await d.store.dispatch(d.S.notes.addNote({ title: 'Nota local', content: 'Solo en este celular' })).unwrap();
  await d.repos.greetings.insertGuest(2025, 'Invitado Local', null, true);
  d.control.reset();
}

const platforms = ['android', 'web'];

async function sourceFile(platform) {
  const source = await device(platform);
  await seedSource(source);
  // El export lee SQLite: la pantalla de saludos nunca se visitó en este store.
  const file = await source.exportFile();
  return { source, file };
}

for (const platform of platforms) {
  test(`${platform}: exporta desde SQLite sin visitar pantallas, con todo el alcance y las exclusiones declaradas`, async () => {
    const { source, file } = await sourceFile(platform);
    try {
      assert.deepEqual(source.store.getState().greetings.items, [], 'la pantalla de saludos nunca se visitó');
      assert.equal(source.control.state.exclusive + source.control.state.regular >= 1, true, 'el export lee dentro de una transacción');
      const backup = JSON.parse(file);
      assert.equal(backup.app, 'crono');
      assert.equal(backup.formatVersion, 2);
      assert.deepEqual(backup.excludes, ['photos', 'giftIdeas']);
      assert.equal(backup.displayName, 'Persona Sintética');
      assert.equal(backup.events.length, 6);
      assert.ok(backup.events.every((event) => event.photoUri === null), 'las fotos no viajan');
      assert.ok(!file.includes('foto-sintetica') && !file.includes('Idea sintética'), 'ni fotos ni ideas de regalo');
      assert.deepEqual(backup.greetings.map((g) => g.year).sort(), [2023, 2024, 2025, 2025, 2025]);
      assert.equal(backup.greetings.filter((g) => g.eventRef !== null).length, 2, 'dos saludos enlazados a Ana');
      assert.deepEqual(backup.greetingsSent.map((s) => s.year).sort(), [2024, 2025, 2025]);
      assert.deepEqual(backup.typeConfig.builtinTypes.find((t) => t.key === 'cumpleanos'), {
        key: 'cumpleanos', label: 'Cumples', icon: 'balloon', color: '#112233',
      });
      assert.equal(backup.typeConfig.types[0].key, 'firulais');
      const luna = backup.events.find((e) => e.title === 'Luna');
      assert.deepEqual(luna.fieldValues, { 'base:Especie': 'Gato', 'type:Juguetes': '["Pelota"]' });
      const refs = backup.events.map((e) => e.ref);
      assert.equal(new Set(refs).size, refs.length, 'los ref son únicos');
    } finally { source.db.close(); }
  });

  test(`${platform}: restaurar en un celular vacío reproduce la agenda y conserva vínculos, campos y tipos`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await target.store.dispatch(target.S.greetings.loadGreetings(2025)).unwrap();
      target.control.state.strict = true; // toda escritura de la restauración debe ir dentro de su transacción
      const summary = await target.restore(file);
      target.control.state.strict = false;
      assert.deepEqual(
        { ...summary, discarded: 0 },
        {
          events: 6, notes: 2, greetings: 5, greetingsSent: 3, skipped: 0, discarded: 0, droppedFieldValues: 0,
          unlinkedGreetings: 0, unknownTypeEvents: 0, skippedTypes: 0, keptLocalTypes: 0, ownBirthdayKept: false,
          displayNameRestored: true, sourceFormatVersion: 2, refreshFailed: false,
        },
      );
      assert.deepEqual(semantic(target.db), semantic(source.db));
      // Vínculos reales: ningún saludo de Ana quedó con event_id null.
      const linked = target.db.prepare(
        'SELECT COUNT(*) AS n FROM greetings g JOIN events e ON e.id = g.event_id WHERE e.title = ?',
      ).get('Ana Prueba').n;
      assert.equal(linked, 2);
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM gift_ideas').get().n, 0, 'regalos fuera del alcance');
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM events WHERE photo_uri IS NOT NULL').get().n, 0);
      assert.deepEqual(target.db.prepare('PRAGMA foreign_key_check').all(), []);
      // Avisos: se programaron en el SO y sus ids se persistieron (1 mi cumple + 2 Ana + 1 reunión).
      assert.equal(target.notifier.active.size, 4);
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM reminders WHERE notification_id IS NOT NULL').get().n, 4);
      // Redux se recargó desde SQLite (incluidos los saludos del año visible).
      const state = target.store.getState();
      assert.equal(state.events.items.length, 6);
      assert.equal(state.settings.displayName, 'Persona Sintética');
      assert.equal(state.notes.items.length, 2);
      assert.deepEqual(state.eventTypes.items.find((t) => t.key === 'cumpleanos').label, 'Cumples');
      assert.deepEqual(state.eventBases.fields.map((f) => f.label).sort(), ['Especie', 'Juguetes']);
      assert.equal(state.greetings.year, 2025);
      assert.equal(state.greetings.items.length, 3, 'saludos de 2025 recargados desde SQLite');
      assert.equal(target.control.state.active, false);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: reimportar el mismo archivo no duplica nada (ni invitados repetidos) y no agrega avisos`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await target.restore(file);
      const before = snapshot(target.db);
      const scheduled = target.notifier.calls;
      const again = await target.restore(file);
      assert.deepEqual(snapshot(target.db), before, 'la segunda importación no cambia ninguna tabla');
      assert.deepEqual(
        { events: again.events, notes: again.notes, greetings: again.greetings, greetingsSent: again.greetingsSent },
        { events: 0, notes: 0, greetings: 0, greetingsSent: 0 },
      );
      assert.equal(again.skipped, 6 + 2 + 5 + 3);
      assert.equal(target.notifier.calls, scheduled, 'no se programan avisos para lo que ya estaba');
      assert.equal(target.notifier.active.size, 4);
      assert.equal(target.control.state.active, false);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: regresión de la secuencia observada: importar, abrir/guardar un evento restaurado y reimportar`, async () => {
    // No se afirma que todo segundo import falle ni se da por explicada la causa del reporte original:
    // esta secuencia, ejecutada contra el código actual, debe terminar sin transacciones abiertas.
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await target.restore(file);
      assert.equal(target.openTransaction(), false);

      // "Abrir y guardar" un evento restaurado: se edita sin tocar su identidad (título, tipo, fecha).
      const restored = target.store.getState().events.items.find((e) => e.title === 'Reunión');
      await target.store.dispatch(target.S.events.editEvent({
        id: restored.id,
        data: { ...restored, description: 'Editada tras restaurar', tags: ['editado'], fieldValues: {} },
        previousReminders: restored.reminders,
      })).unwrap();
      assert.equal(target.control.state.active, false);
      assert.equal(target.openTransaction(), false);

      // Un invitado restaurado se enlaza después a un evento (acción normal de la pantalla de saludos).
      const guest = target.db.prepare("SELECT id FROM greetings WHERE name = 'Invitado Uno' ORDER BY id").get();
      const luna = target.store.getState().events.items.find((e) => e.title === 'Luna');
      await target.repos.greetings.linkGuestToEvent(guest.id, luna.id);

      const before = snapshot(target.db);
      const again = await target.restore(file);
      assert.equal(target.control.state.active, false);
      assert.equal(target.openTransaction(), false, 'no queda ninguna transacción abierta tras reimportar');
      assert.deepEqual({ events: again.events, notes: again.notes, greetings: again.greetings }, { events: 0, notes: 0, greetings: 0 });
      assert.deepEqual(snapshot(target.db), before, 'ni la edición ni el invitado enlazado se pisan ni se duplican');
      // Se puede seguir guardando eventos después.
      await target.store.dispatch(target.S.events.addEvent({ ...original, title: 'Posterior' })).unwrap();
      assert.equal(target.openTransaction(), false);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: restaurar no se superpone con un guardado ni con otra restauración`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await target.restore(file);
      const restored = target.store.getState().events.items.find((e) => e.title === 'Reunión');
      target.files.picked = file;
      const results = await Promise.allSettled([
        target.store.dispatch(target.S.events.editEvent({
          id: restored.id, data: { ...restored, tags: [], fieldValues: {} }, previousReminders: restored.reminders,
        })).unwrap(),
        target.store.dispatch(target.S.backup.restoreBackup()).unwrap(),
        target.store.dispatch(target.S.backup.restoreBackup()).unwrap(),
        target.store.dispatch(target.S.events.addEvent({ ...original, title: 'Concurrente' })).unwrap(),
      ]);
      assert.deepEqual(results.map((r) => r.status), ['fulfilled', 'fulfilled', 'fulfilled', 'fulfilled']);
      assert.equal(target.openTransaction(), false);
      assert.equal(target.db.prepare("SELECT COUNT(*) AS n FROM events WHERE title = 'Ana Prueba'").get().n, 1);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: ante una falla en cualquier escritura se revierte todo, se cancelan los avisos y se puede reintentar`, async (t) => {
    const { source, file } = await sourceFile(platform);
    const baseline = await device(platform);
    let total;
    try {
      await seedLocal(baseline);
      baseline.control.reset();
      await baseline.restore(file);
      total = baseline.control.state.writes;
      assert.ok(total >= 40, `se ejercitan tipos, eventos, notas, saludos y nombre (${total} escrituras)`);
    } finally { baseline.db.close(); }
    for (let cut = 1; cut <= total; cut += 1) {
      await t.test(`falla después de la escritura ${cut}/${total}`, async () => {
        const target = await device(platform);
        try {
          await seedLocal(target);
          const beforeDb = snapshot(target.db);
          const beforeStore = target.store.getState();
          const activeBefore = [...target.notifier.active];
          target.control.reset(cut);
          await assert.rejects(target.restore(file), (error) => {
            assert.equal(typeof error.message, 'string');
            assert.match(error.message, /Interrupción entre escrituras/);
            assert.match(error.message, /No se modificó ningún dato/);
            return true;
          });
          assert.deepEqual(snapshot(target.db), beforeDb, 'los datos previos quedan íntegros');
          assert.deepEqual(target.store.getState(), beforeStore, 'Redux no cambia');
          assert.deepEqual([...target.notifier.active], activeBefore, 'los avisos recién programados se cancelaron');
          assert.equal(target.control.state.active, false);
          assert.equal(target.openTransaction(), false);
          target.control.reset();
          const summary = await target.restore(file);
          assert.equal(summary.events, 6);
          assert.deepEqual(target.db.prepare('PRAGMA foreign_key_check').all(), []);
        } finally { target.db.close(); }
      });
    }
    source.db.close();
  });

  test(`${platform}: si el sistema rechaza un aviso no se escribe nada y se cancelan los anteriores`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await seedLocal(target);
      const before = snapshot(target.db);
      const activeBefore = [...target.notifier.active];
      target.notifier.failOn = target.notifier.calls + 3; // falla en el tercer evento a programar
      await assert.rejects(target.restore(file), (error) => {
        assert.match(error.message, /El sistema rechazó programar el aviso[\s\S]*No se modificó ningún dato/);
        return true;
      });
      assert.deepEqual(snapshot(target.db), before);
      assert.deepEqual([...target.notifier.active], activeBefore);
      target.notifier.failOn = null;
      assert.equal((await target.restore(file)).events, 6);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: si la agenda cambia entre planificar los avisos y escribir, no se mezcla nada`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      const backup = target.load('@/backup/backup').parseBackup(file).backup;
      const missing = await target.repos.backup.findMissingEventIndexes(backup);
      assert.equal(missing.length, 6);
      // Otro guardado mete uno de esos eventos justo antes de escribir.
      await target.repos.events.insertEvent({ ...original, title: 'Reunión', date: '2026-12-01', time: '10:30' }, []);
      const before = snapshot(target.db);
      await assert.rejects(
        target.repos.backup.applyBackupRestore(backup, new Map(missing.map((i) => [i, []]))),
        /La agenda cambió mientras se restauraba/,
      );
      assert.deepEqual(snapshot(target.db), before);
      assert.equal(target.openTransaction(), false);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: no pisa lo que ya existe (mi cumpleaños, nombre, personalización local) y lo avisa`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await target.repos.settings.setSetting('displayName', 'Nombre Local');
      const [birthdayType] = (await target.repos.eventTypes.findAllEventTypes()).filter((t) => t.key === 'cumpleanos');
      await target.repos.eventTypes.updateEventType(
        birthdayType.id,
        { label: 'Mis cumples', icon: 'gift', color: '#abcdef', baseKey: 'cumpleanos', extraCapabilities: [], fields: [] },
        NO_PLAN,
      );
      await target.store.dispatch(target.S.events.addEvent({
        ...original, title: 'Mi cumple local', type: 'mi_cumpleanos', date: '1991-06-06', yearly: 1, isMine: 1,
      })).unwrap();
      const summary = await target.restore(file);
      assert.equal(summary.ownBirthdayKept, true);
      assert.equal(summary.keptLocalTypes, 1);
      assert.equal(summary.displayNameRestored, false);
      const mine = target.db.prepare('SELECT title FROM events WHERE is_mine = 1').all();
      assert.deepEqual(JSON.parse(JSON.stringify(mine)), [{ title: 'Mi cumple local' }], 'la marca de propio no se robó');
      assert.equal(target.db.prepare("SELECT COUNT(*) AS n FROM events WHERE title = 'Mi cumple sintético' AND is_mine = 0").get().n, 1);
      assert.equal(target.db.prepare("SELECT label FROM event_types WHERE key = 'cumpleanos'").get().label, 'Mis cumples');
      assert.equal(target.db.prepare("SELECT value FROM settings WHERE key = 'displayName'").get().value, 'Nombre Local');
      // Reimportar sigue siendo idempotente aun en este camino.
      const before = snapshot(target.db);
      await target.restore(file);
      assert.deepEqual(snapshot(target.db), before);
      const text = target.load('@/backup/backup').describeRestore(summary);
      assert.match(text.message, /mi cumpleaños/);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: enlaza saludos a eventos que ya estaban y suma los campos que le faltan a un tipo existente`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      // Este celular ya tiene a Ana (sin saludos) y un tipo 'firulais' al que le falta el campo "Juguetes".
      const base = await target.repos.eventBases.createEventBase({
        label: 'Mascota', yearly: true, requiresTime: false, capabilities: ['edad'],
        fields: [{ label: 'Especie', kind: 'select', options: ['Perro', 'Gato'], required: true }],
      });
      await target.repos.eventTypes.createEventType({
        label: 'Firulais', icon: 'paw', color: '#000000', baseKey: base.key, extraCapabilities: [], fields: [],
      });
      await target.reloadAll();
      const ana = await target.store.dispatch(target.S.events.addEvent({
        ...original, title: 'Ana Prueba', type: 'cumpleanos', date: '1980-03-03', yearly: 1,
      })).unwrap();
      const summary = await target.restore(file);
      assert.equal(summary.events, 5);
      assert.equal(summary.skipped, 1);
      assert.equal(summary.droppedFieldValues, 0);
      const anaGreetings = target.db.prepare('SELECT year, event_id AS eventId FROM greetings WHERE event_id = ? ORDER BY year').all(ana.id);
      assert.deepEqual(JSON.parse(JSON.stringify(anaGreetings)), [{ year: 2024, eventId: ana.id }, { year: 2025, eventId: ana.id }]);
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM greetings_sent WHERE event_id = ?').get(ana.id).n, 2);
      const added = target.db.prepare("SELECT label, required FROM custom_fields WHERE label = 'Juguetes'").get();
      assert.equal(added.required, 0, 'un campo sumado a un tipo existente entra como opcional');
      assert.equal(target.db.prepare("SELECT value FROM event_field_values v JOIN custom_fields f ON f.id = v.field_id WHERE f.label = 'Juguetes'").get().value, '["Pelota"]');
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: recrea un tipo de fábrica borrado que usan los eventos del archivo`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      target.db.exec("DELETE FROM event_types WHERE key = 'cumpleanos'");
      await target.restore(file);
      const row = target.db.prepare("SELECT label, is_builtin AS isBuiltin FROM event_types WHERE key = 'cumpleanos'").get();
      assert.deepEqual(JSON.parse(JSON.stringify(row)), { label: 'Cumples', isBuiltin: 1 });
    } finally { source.db.close(); target.db.close(); }
  });
}

test('un backup v1 sigue leyéndose: invitados sin vínculo, sin campos de v2, e idempotente', async () => {
  const target = await device('android');
  try {
    const v1 = JSON.stringify({
      app: 'crono', formatVersion: 1, exportedAt: '2026-07-12T12:00:00.000Z', displayName: 'Nombre V1',
      events: [
        { title: 'Evento v1', type: 'evento', date: '2026-08-01', yearly: 0, ref: 'x1', reminders: [] },
        { title: 'Dañado', type: 'evento', yearly: 0 },
      ],
      notes: [{ title: 'Nota v1', content: 'c' }, { title: '', content: '' }],
      greetings: [
        { year: 2025, eventId: null, name: 'Invitado V1', phone: null, greeted: 1, eventRef: 'x1' },
        { year: 2025, eventId: null, name: 'Invitado V1', phone: null, greeted: 1 },
      ],
      greetingsSent: [{ year: 2025, eventRef: 'x1', greeted: 1 }],
      typeConfig: { builtinTypes: [{ key: 'cumpleanos', label: 'No debe aplicarse', icon: 'x', color: '#000' }] },
    });
    const first = await target.restore(v1);
    assert.equal(first.sourceFormatVersion, 1);
    assert.equal(first.discarded, 2, 'lo dañado se cuenta, no se pierde en silencio');
    assert.deepEqual(
      { events: first.events, notes: first.notes, greetings: first.greetings, greetingsSent: first.greetingsSent },
      { events: 1, notes: 1, greetings: 2, greetingsSent: 0 },
    );
    // v1 no tiene vínculo: ref/eventRef de v2 NO se interpretan en un archivo v1.
    assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM greetings WHERE event_id IS NOT NULL').get().n, 0);
    assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM greetings_sent').get().n, 0);
    assert.notEqual(target.db.prepare("SELECT label FROM event_types WHERE key = 'cumpleanos'").get().label, 'No debe aplicarse');
    assert.equal(target.db.prepare("SELECT value FROM settings WHERE key = 'displayName'").get().value, 'Nombre V1');
    const before = snapshot(target.db);
    const again = await target.restore(v1);
    assert.deepEqual(snapshot(target.db), before);
    assert.equal(again.events + again.notes + again.greetings, 0);
    assert.match(target.load('@/backup/backup').describeRestore(first).message, /formato anterior/);
  } finally { target.db.close(); }
});

test('rechaza versiones no soportadas y archivos ajenos sin tocar los datos', async () => {
  const target = await device('android');
  try {
    await seedLocal(target);
    const before = snapshot(target.db);
    const callsBefore = target.notifier.calls;
    const body = { app: 'crono', events: [{ title: 'X', type: 'evento', date: '2026-01-01', yearly: 0 }], notes: [] };
    for (const formatVersion of [3, 99, 0, -1, 1.5, '2', null]) {
      await assert.rejects(
        target.restore(JSON.stringify({ ...body, formatVersion })),
        (error) => typeof error === 'string' && /versión/.test(error),
        `formatVersion ${JSON.stringify(formatVersion)}`,
      );
    }
    await assert.rejects(target.restore('no es json'), (error) => error === 'El archivo no es un backup válido de Crono.');
    await assert.rejects(target.restore(JSON.stringify({ ...body, formatVersion: 2, events: [{ title: '' }] })), /datos válidos/);
    assert.deepEqual(snapshot(target.db), before);
    assert.equal(target.notifier.calls, callsBefore, 'un archivo rechazado no programa avisos');
    assert.equal(target.openTransaction(), false);
  } finally { target.db.close(); }
});

test('valores de campos sin campo equivalente se cuentan y avisan (no se pierden en silencio)', async () => {
  const target = await device('android');
  try {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 2, displayName: null, notes: [],
      events: [{ title: 'Con campo ajeno', type: 'evento', date: '2026-01-01', yearly: 0, ref: 'e1', fieldValues: { 'type:Inexistente': 'valor', 'base:Vacío': '  ' } }],
    });
    const summary = await target.restore(raw);
    assert.equal(summary.events, 1);
    assert.equal(summary.droppedFieldValues, 1, 'el valor vacío no es dato; el otro se informa');
    assert.match(target.load('@/backup/backup').describeRestore(summary).message, /no se pudo restaurar/);
  } finally { target.db.close(); }
});

test('control del harness: una transacción NO encolada que se superpone reproduce el mensaje del reporte (web)', async () => {
  // Evidencia de MECANISMO, no de la causa del reporte original: el código previo restauraba los tipos con
  // `db.withTransactionAsync` fuera de la cola de escritura; en una sola conexión (web) eso, superpuesto con un
  // guardado, produce exactamente este error. La restauración actual pasa por la misma cola que los guardados.
  const target = await device('web');
  try {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const unqueued = target.control.adapter.withTransactionAsync(async () => {
      await target.control.adapter.runAsync("INSERT INTO notes (title, content, created_at, updated_at) VALUES ('x', 'y', 'z', 'z')");
      await gate;
    });
    const queued = target.repos.events.insertEvent({ ...original, title: 'Cola' }, []);
    // Los handlers se enganchan YA: el rechazo ocurre antes de que se suelte la compuerta.
    const settled = Promise.allSettled([unqueued, queued]);
    await new Promise((resolve) => setImmediate(resolve));
    release();
    const [a, b] = await settled;
    assert.ok(
      [a, b].some((r) => r.status === 'rejected' && /cannot start a transaction within a transaction|cannot commit|cannot rollback/.test(String(r.reason?.message))),
      'la superposición real en una conexión produce el error de SQLite',
    );
  } finally { target.db.close(); }
});

for (const platform of platforms) {
  test(`${platform}: dos restauraciones compitiendo en un celular vacío: una gana, la otra aborta y cancela sus avisos`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      let release;
      target.notifier.hold = new Promise((resolve) => { release = resolve; });
      target.files.picked = file;
      // Ambas planifican (ven los 6 eventos como faltantes) y programan avisos ANTES de que cualquiera escriba.
      const first = target.store.dispatch(target.S.backup.restoreBackup());
      const second = target.store.dispatch(target.S.backup.restoreBackup());
      while (target.notifier.calls < 2) await new Promise((resolve) => setImmediate(resolve));
      release();
      target.notifier.hold = null;
      const results = await Promise.all([first, second]);
      const outcomes = results.map((r) => r.meta.requestStatus).sort();
      assert.deepEqual(outcomes, ['fulfilled', 'rejected']);
      const failed = results.find((r) => r.meta.requestStatus === 'rejected');
      assert.match(failed.error.message, /La agenda cambió mientras se restauraba[\s\S]*No se modificó ningún dato/);
      // Nada duplicado y ningún aviso huérfano en el SO: solo quedan los de la restauración que ganó.
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 6);
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM greetings').get().n, 5);
      const persisted = target.db.prepare('SELECT notification_id AS id FROM reminders WHERE notification_id IS NOT NULL').all().map((r) => r.id).sort();
      assert.deepEqual([...target.notifier.active].sort(), persisted);
      assert.equal(persisted.length, 4);
      assert.equal(target.openTransaction(), false);
    } finally { source.db.close(); target.db.close(); }
  });
}

test('dos "mi cumpleaños" en el archivo y ninguno local: uno queda propio y el otro se agrega común, avisándolo', async () => {
  const target = await device('android');
  try {
    const mine = (title) => ({ title, type: 'mi_cumpleanos', date: '1990-05-05', yearly: 1, isMine: 1 });
    const raw = JSON.stringify({ app: 'crono', formatVersion: 2, notes: [], events: [mine('Propio A'), mine('Propio B')] });
    const summary = await target.restore(raw);
    assert.equal(summary.ownBirthdayKept, true);
    const rows = JSON.parse(JSON.stringify(target.db.prepare('SELECT title, is_mine AS isMine FROM events ORDER BY id').all()));
    assert.deepEqual(rows, [{ title: 'Propio A', isMine: 1 }, { title: 'Propio B', isMine: 0 }]);
    const before = snapshot(target.db);
    await target.restore(raw);
    assert.deepEqual(snapshot(target.db), before);
    assert.match(target.load('@/backup/backup').describeRestore(summary).message, /Solo un evento puede ser "mi cumpleaños"/);
  } finally { target.db.close(); }
});

for (const platform of platforms) {
  test(`${platform}: tras borrar un evento el export no incluye saludos ni marcas huérfanos`, async () => {
    const { source } = await sourceFile(platform);
    try {
      const ana = source.store.getState().events.items.find((e) => e.title === 'Ana Prueba');
      await source.store.dispatch(source.S.events.removeEvent(ana)).unwrap();
      const backup = JSON.parse(await source.exportFile());
      assert.ok(!backup.greetings.some((g) => g.name === 'Ana Prueba'), 'ni como invitados sueltos');
      assert.deepEqual(backup.greetingsSent.map((s) => s.year), [2025], 'solo queda la marca de Luna');
      assert.deepEqual(backup.greetings.map((g) => g.year).sort(), [2023, 2025, 2025]);
    } finally { source.db.close(); }
  });
}

// Depende del fix de cascada de deleteEvent (FkCascadeFix): sobre la conexión exclusiva nativa no hay ON DELETE CASCADE.
for (const platform of platforms) {
  test(`${platform}: borrar un evento no deja saludos ni marcas huérfanos en SQLite`, async () => {
    const { source } = await sourceFile(platform);
    try {
      const ana = source.store.getState().events.items.find((e) => e.title === 'Ana Prueba');
      await source.store.dispatch(source.S.events.removeEvent(ana)).unwrap();
      for (const table of ['greetings', 'greetings_sent', 'reminders', 'event_tags', 'event_field_values', 'gift_ideas']) {
        const n = source.db.prepare(
          `SELECT COUNT(*) AS n FROM ${table} WHERE event_id NOT IN (SELECT id FROM events)`,
        ).get().n;
        assert.equal(n, 0, `${table} no debe conservar filas de un evento borrado`);
      }
      assert.deepEqual(source.db.prepare('PRAGMA foreign_key_check').all(), []);
    } finally { source.db.close(); }
  });
}

const localBaseDraft = {
  label: 'Base del writer', yearly: false, requiresTime: false, capabilities: [],
  fields: [{ label: 'Campo base local', kind: 'texto', options: [], required: false }],
};
const localTypeDraft = {
  label: 'Tipo del writer', icon: 'star', color: '#123456', baseKey: 'evento', extraCapabilities: [],
  fields: [{ label: 'Campo tipo local', kind: 'texto', options: [], required: false }],
};

async function writerFixture(d) {
  await seedLocal(d);
  const base = await d.repos.eventBases.createEventBase(localBaseDraft);
  const type = await d.repos.eventTypes.createEventType(localTypeDraft);
  const emptyType = await d.repos.eventTypes.createEventType({ ...localTypeDraft, label: 'Tipo sin eventos' });
  const event = await d.repos.events.insertEvent({ ...original, title: 'Evento del writer', type: type.key }, []);
  d.db.exec("DELETE FROM event_types WHERE key = 'festivo'");
  d.control.reset();
  return { base, type, emptyType, event };
}

const concurrentWriters = [
  ['crear base', (d) => d.repos.eventBases.createEventBase({ ...localBaseDraft, label: 'Base concurrente' }),
    (d) => assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM event_bases WHERE label = 'Base concurrente'").get().n, 1)],
  ['editar base', (d, f) => d.repos.eventBases.updateEventBase(f.base.id, { ...localBaseDraft, label: 'Base editada', fields: [] }, NO_PLAN),
    (d, f) => assert.equal(d.db.prepare('SELECT label FROM event_bases WHERE id = ?').get(f.base.id).label, 'Base editada')],
  ['borrar base', (d, f) => d.repos.eventBases.deleteEventBase(f.base.id),
    (d, f) => assert.equal(d.db.prepare('SELECT id FROM event_bases WHERE id = ?').get(f.base.id), undefined)],
  ['crear tipo', (d) => d.repos.eventTypes.createEventType({ ...localTypeDraft, label: 'Tipo concurrente' }),
    (d) => assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM event_types WHERE label = 'Tipo concurrente'").get().n, 1)],
  ['editar tipo', (d, f) => d.repos.eventTypes.updateEventType(f.type.id, { ...localTypeDraft, label: 'Tipo editado', fields: [] }, NO_PLAN),
    (d, f) => assert.equal(d.db.prepare('SELECT label FROM event_types WHERE id = ?').get(f.type.id).label, 'Tipo editado')],
  ['borrar tipo vacío', (d, f) => d.repos.eventTypes.deleteEventType(f.emptyType.id),
    (d, f) => assert.equal(d.db.prepare('SELECT id FROM event_types WHERE id = ?').get(f.emptyType.id), undefined)],
  ['borrar tipo moviendo eventos', (d, f) => d.repos.eventTypes.deleteEventTypeMovingEvents(f.type.id, f.type.key, 'evento', NO_PLAN),
    (d, f) => assert.equal(d.db.prepare('SELECT type FROM events WHERE id = ?').get(f.event.id).type, 'evento')],
  ['borrar tipo con eventos', (d, f) => d.repos.eventTypes.deleteEventTypeWithEvents(f.type.id, f.type.key),
    (d, f) => assert.equal(d.db.prepare('SELECT id FROM events WHERE id = ?').get(f.event.id), undefined)],
  ['recrear tipo de fábrica', (d) => d.repos.eventTypes.ensureBuiltinType('festivo'),
    (d) => assert.equal(d.db.prepare("SELECT is_builtin FROM event_types WHERE key = 'festivo'").get().is_builtin, 1)],
  ['guardar nota', (d) => d.load('@/db/notes-repo').insertNote({ title: 'Nota concurrente', content: 'Independiente' }),
    (d) => assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM notes WHERE title = 'Nota concurrente'").get().n, 1)],
  ['guardar perfil', (d) => d.repos.settings.setSetting('displayName', 'Perfil concurrente'),
    (d) => assert.equal(d.db.prepare("SELECT value FROM settings WHERE key = 'displayName'").get().value, 'Perfil concurrente')],
  ['guardar saludo', (d, f) => d.repos.greetings.setGreetedForEvent(2026, f.event.id, 'Saludo concurrente', null, true),
    (d) => assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM greetings WHERE name = 'Saludo concurrente'").get().n, 1)],
  ['guardar marca de saludo', (d, f) => d.repos.sent.setGreetingSent(2026, f.event.id, true),
    (d, f) => assert.equal(d.db.prepare('SELECT greeted FROM greetings_sent WHERE event_id = ?').get(f.event.id).greeted, 1)],
  ['guardar idea de regalo', (d, f) => d.load('@/db/gift-ideas-repo').insertGiftIdea({ eventId: f.event.id, text: 'Regalo concurrente' }),
    (d) => assert.equal(d.db.prepare("SELECT COUNT(*) AS n FROM gift_ideas WHERE text = 'Regalo concurrente'").get().n, 1)],
];

for (const fails of [true, false]) {
  for (const [name, write, verify] of concurrentWriters) {
    test(`web: restore ${fails ? 'revierte' : 'confirma'} antes de ${name} y del snapshot encolados`, async () => {
      const target = await device('web');
      let pause;
      try {
        const fixture = await writerFixture(target);
        const before = snapshot(target.db);
        const raw = JSON.stringify({
          app: 'crono', formatVersion: 2, displayName: null,
          events: [{ ...original, title: 'Evento restaurado concurrente' }],
          notes: [{ title: 'Nota restaurada concurrente', content: 'Completa o nada' }],
        });
        target.control.reset(fails ? 2 : null);
        pause = target.control.pauseAfterWrite(1);
        const restoring = target.restore(raw);
        const restoreOutcome = Promise.allSettled([restoring]);
        await pause.reached; // El evento ya está escrito, pero la unidad todavía no confirmó.
        assert.equal(target.control.state.active, true);
        assert.equal(target.db.prepare("SELECT COUNT(*) AS n FROM events WHERE title = 'Evento restaurado concurrente'").get().n, 1);
        let atWriterBegin;
        target.control.state.onBegin = () => { atWriterBegin = snapshot(target.db); };
        const regularBefore = target.control.state.regular;
        let writerSettled = false;
        let snapshotSettled = false;
        const writing = write(target, fixture).then(() => { writerSettled = true; });
        const reading = target.repos.backup.readBackupSnapshot().then((result) => { snapshotSettled = true; return result; });
        const outcomes = Promise.allSettled([writing, reading]);
        await new Promise((resolve) => setImmediate(resolve));
        assert.equal(writerSettled, false, 'el writer real espera fuera de la transacción del restore');
        assert.equal(snapshotSettled, false, 'el export no lee el restore a medio escribir');
        assert.equal(target.control.state.regular, regularBefore, 'ningún BEGIN competidor alcanzó SQLite');
        pause.release();
        const [restoreResult] = await restoreOutcome;
        const [writerResult, snapshotResult] = await outcomes;
        assert.equal(restoreResult.status, fails ? 'rejected' : 'fulfilled');
        if (fails) {
          assert.match(String(restoreResult.reason?.message ?? restoreResult.reason), /Interrupción entre escrituras/);
          assert.deepEqual(atWriterBegin, before, 'rollback completo ANTES de comenzar el writer independiente');
        } else {
          assert.equal(atWriterBegin.events.length, before.events.length + 1);
          assert.equal(atWriterBegin.notes.length, before.notes.length + 1);
        }
        assert.equal(writerResult.status, 'fulfilled', String(writerResult.reason));
        assert.equal(snapshotResult.status, 'fulfilled', String(snapshotResult.reason));
        verify(target, fixture);
        assert.equal(snapshotResult.value.events.some((event) => event.title === 'Evento restaurado concurrente'), !fails);
        assert.equal(snapshotResult.value.notes.some((note) => note.title === 'Nota restaurada concurrente'), !fails);
        assert.deepEqual(target.db.prepare('PRAGMA foreign_key_check').all(), []);
        assert.equal(target.control.state.active, false);
        assert.equal(target.openTransaction(), false);
      } finally {
        pause?.release();
        target.db.close();
      }
    });
  }
}

for (const platform of platforms) {
  test(`${platform}: el borrado de tipo conserva las cascadas en la conexión principal serializada`, async () => {
    const target = await device(platform);
    try {
      const { type, event } = await writerFixture(target);
      const field = target.db.prepare('SELECT id FROM custom_fields WHERE type_id = ?').get(type.id);
      target.db.prepare('INSERT INTO event_field_values (event_id, field_id, value) VALUES (?, ?, ?)').run(event.id, field.id, 'Valor local');
      await target.repos.greetings.setGreetedForEvent(2026, event.id, 'Vínculo conservado', null, true);
      await target.repos.sent.setGreetingSent(2026, event.id, true);
      await target.load('@/db/gift-ideas-repo').insertGiftIdea({ eventId: event.id, text: 'Regalo' });
      target.control.reset();
      await target.repos.eventTypes.deleteEventTypeWithEvents(type.id, type.key);
      assert.equal(target.control.state.regular, 1, 'la unidad usa la principal con FK activas');
      assert.equal(target.control.state.exclusive, 0);
      for (const table of ['reminders', 'greetings', 'greetings_sent', 'gift_ideas', 'event_tags', 'event_field_values']) {
        assert.equal(target.db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE event_id = ?`).get(event.id).n, 0);
      }
      assert.equal(target.db.prepare('SELECT COUNT(*) AS n FROM custom_fields WHERE type_id = ?').get(type.id).n, 0);
      assert.deepEqual(target.db.prepare('PRAGMA foreign_key_check').all(), []);
      assert.equal(target.openTransaction(), false);
    } finally { target.db.close(); }
  });
}

for (const platform of platforms) {
  test(`${platform}: compensación de restore rechazada registra IDs y reintenta limpieza sin programar`, async () => {
    const { source, file } = await sourceFile(platform);
    const target = await device(platform);
    try {
      await seedLocal(target);
      const before = semantic(target.db);
      const activeBefore = [...target.notifier.active].sort();
      const stuck = `aviso-${target.notifier.next}`;
      target.notifier.failCancelIds.add(stuck);
      target.control.reset(1);
      await assert.rejects(target.restore(file), (error) => {
        assert.match(error.message, /Interrupción entre escrituras/);
        assert.match(error.message, /SQLite[\s\S]*limpieza de avisos pendiente/);
        return true;
      });
      assert.deepEqual(semantic(target.db), before, 'el contenido previo de SQLite sigue intacto');
      const cleanup = target.load('@/notifications/cancel-after-commit');
      const pending = JSON.parse(await target.repos.settings.getSetting(cleanup.PENDING_CANCELLATIONS_KEY));
      assert.ok(pending.includes(stuck), 'ningún ID rechazado queda sin referencia persistida');
      const calls = target.notifier.calls;
      await assert.rejects(target.restore(file));
      assert.equal(target.notifier.calls, calls, 'repetir restore no suma avisos mientras queda limpieza');
      const dialogs = target.load('@/components/confirm');
      const dialog = dialogs.currentDialog();
      assert.equal(dialog.title, 'Limpieza de avisos pendiente');
      assert.ok(dialog.buttons.some((button) => button.label === 'Reintentar limpieza'));
      target.notifier.failCancelIds.clear();
      dialogs.resolveDialog(dialog.id, true);
      await cleanup.retryPendingReminderCancellations();
      assert.equal(target.notifier.calls, calls, 'el botón sólo limpia IDs existentes');
      assert.deepEqual([...target.notifier.active].sort(), activeBefore);
      assert.equal(await target.repos.settings.getSetting(cleanup.PENDING_CANCELLATIONS_KEY), '[]');
      assert.equal(target.openTransaction(), false);
    } finally { source.db.close(); target.db.close(); }
  });

  test(`${platform}: borrar tipo conserva IDs rechazados y limpia sin recrear eventos`, async () => {
    const target = await device(platform);
    try {
      const type = await target.repos.eventTypes.createEventType({ ...localTypeDraft, label: 'Con avisos' });
      const event = await target.store.dispatch(target.S.events.addEvent({
        ...original, type: type.key, reminders: [{ amount: 1, unit: 'dias' }],
      })).unwrap();
      const [stuck] = event.reminders.map((reminder) => reminder.notificationId);
      target.notifier.failCancelIds.add(stuck);
      await target.store.dispatch(target.load('@/store/type-config-thunks').deleteTypeWithEvents({
        id: type.id, key: type.key, events: [event],
      })).unwrap();
      assert.equal(target.store.getState().events.items.length, 0);
      const cleanup = target.load('@/notifications/cancel-after-commit');
      assert.ok(JSON.parse(await target.repos.settings.getSetting(cleanup.PENDING_CANCELLATIONS_KEY)).includes(stuck));
      const calls = target.notifier.calls;
      target.notifier.failCancelIds.clear();
      await cleanup.retryPendingReminderCancellations();
      assert.equal(target.notifier.calls, calls);
      assert.deepEqual([...target.notifier.active], []);
      assert.equal(await target.repos.settings.getSetting(cleanup.PENDING_CANCELLATIONS_KEY), '[]');
    } finally { target.db.close(); }
  });
}
