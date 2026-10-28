'use strict';

// QA: node --test scripts/test-reminders.cjs (Node >=22.13).
//
// Qué es real y qué se sustituye:
//  - REAL: SQLite (node:sqlite), Redux Toolkit, y TODO el código de producción de
//    recordatorios (src/notifications/*, src/store/events-slice.ts, src/db/*).
//  - REAL: el validador de triggers de Expo 57. Se carga el JavaScript compilado de
//    node_modules/expo-notifications/build/scheduleNotificationAsync.js, así que
//    `month` fuera de 0..11 o un día inexistente lanzan el RangeError verdadero.
//  - SUSTITUIDO: sólo el módulo NATIVO (NotificationScheduler): un doble que guarda
//    lo que el SO aceptaría, puede fallar a pedido y cancela por id.
// Nada de esto prueba entrega real, permisos ni reinicio del SO: eso requiere la
// candidata Android.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { mock, test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const { configureStore } = require('@reduxjs/toolkit');

const root = path.resolve(__dirname, '..');
const expoBuild = path.join(root, 'node_modules', 'expo-notifications', 'build');
const compiled = new Map();
const failure = new Error('Interrupción entre escrituras del evento');

function compile(filename) {
  if (!compiled.has(filename)) {
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
      fileName: filename,
    });
    compiled.set(filename, vm.runInThisContext(
      `(function(require, module, exports) { ${outputText}\n})`, { filename },
    ));
  }
  return compiled.get(filename);
}

// ---------------------------------------------------------------------------
// Doble del módulo nativo + JavaScript REAL de Expo por encima.
// ---------------------------------------------------------------------------

function createNative() {
  const store = new Map(); // id -> { content, trigger } (lo que el SO tiene programado)
  const log = []; // 'schedule:<id>' | 'cancel:<id>', en orden
  const state = {
    scheduleCalls: 0,
    failScheduleAt: null, // n-ésima llamada a schedule (acumulada) que debe fallar
    failCancelIds: new Set(),
    onSchedule: null, // async (n) => void, para simular cambios concurrentes
    onCancel: null, // (id) => void, para observar el estado de la BD al cancelar
  };
  let uuid = 0;

  const scheduler = {
    scheduleNotificationAsync: async (identifier, content, trigger) => {
      state.scheduleCalls += 1;
      if (state.onSchedule) await state.onSchedule(state.scheduleCalls);
      if (state.failScheduleAt === state.scheduleCalls) {
        state.failScheduleAt = null;
        throw new Error('El SO rechazó programar el aviso');
      }
      assert.ok(trigger && typeof trigger === 'object', 'el trigger llega parseado al nativo');
      if (trigger.type === 'yearly') {
        for (const key of ['month', 'day', 'hour', 'minute']) {
          assert.ok(Number.isInteger(trigger[key]), `yearly.${key} entero`);
        }
        assert.ok(trigger.month >= 0 && trigger.month <= 11, 'yearly.month en 0..11');
      }
      store.set(identifier, { content, trigger });
      log.push(`schedule:${identifier}`);
      return identifier;
    },
  };

  const expoModules = {
    'expo-modules-core': {
      Platform: { OS: 'android', select: (spec) => ('android' in spec ? spec.android : spec.default) },
      UnavailabilityError: class UnavailabilityError extends Error {},
      uuid: { v4: () => `notif-${++uuid}` },
    },
    expo: { PermissionStatus: {} },
    './NotificationScheduler': { __esModule: true, default: scheduler },
  };
  const loaded = new Map();
  function loadExpo(name) {
    if (name in expoModules) return expoModules[name];
    const filename = path.join(expoBuild, `${name.replace(/^\.\//, '')}.js`);
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const module = { exports: {} };
    loaded.set(filename, module);
    compile(filename)(loadExpo, module, module.exports);
    return module.exports;
  }
  const realSchedule = loadExpo('./scheduleNotificationAsync');
  const types = loadExpo('./Notifications.types');

  const api = {
    SchedulableTriggerInputTypes: types.SchedulableTriggerInputTypes,
    AndroidImportance: { HIGH: 4 },
    // JavaScript real de Expo: parseTrigger valida month/day/hour/minute como en producción.
    scheduleNotificationAsync: realSchedule.scheduleNotificationAsync,
    cancelScheduledNotificationAsync: async (identifier) => {
      assert.equal(typeof identifier, 'string');
      if (state.onCancel) state.onCancel(identifier);
      if (state.failCancelIds.has(identifier)) throw new Error(`El SO no pudo cancelar ${identifier}`);
      store.delete(identifier);
      log.push(`cancel:${identifier}`);
    },
    getAllScheduledNotificationsAsync: async () => [...store.entries()].map(([identifier, entry]) => ({ identifier, ...entry })),
    setNotificationHandler: () => undefined,
    setNotificationChannelAsync: async () => undefined,
    getPermissionsAsync: async () => ({ status: 'granted' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
  };

  return {
    api,
    state,
    log,
    /** Un aviso que quedó programado por una versión vieja de la app (no pasa por el validador). */
    seed: (identifier, trigger) => store.set(identifier, { content: { title: 'legado' }, trigger }),
    ids: () => [...store.keys()].sort(),
    trigger: (identifier) => store.get(identifier)?.trigger,
    snapshot: () => JSON.parse(JSON.stringify([...store.entries()].sort(([a], [b]) => (a < b ? -1 : 1)))),
    clearFailures: () => {
      state.failScheduleAt = null;
      state.failCancelIds.clear();
      state.onSchedule = null;
      state.onCancel = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Adaptador SQLite: node:sqlite con la API de expo-sqlite que usa producción.
// ---------------------------------------------------------------------------

function adapterFor(db) {
  let active = false;
  let cut = null;
  let writes = 0;
  const params = (args) => (args.length === 1 && Array.isArray(args[0]) ? args[0] : args);
  const executor = {
    runAsync: async (sql, ...args) => {
      const result = db.prepare(sql).run(...params(args));
      if (active) {
        writes += 1;
        if (writes === cut) {
          cut = null;
          throw failure; // Se corta DESPUÉS de escribir para demostrar rollback real.
        }
      } else {
        // Fuera de una transacción sólo se admiten las preferencias (marca del contrato).
        assert.match(sql, /settings/, 'una escritura de eventos/avisos escapó de su transacción');
      }
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...params(args)) ?? null,
    getAllAsync: async (sql, ...args) => db.prepare(sql).all(...params(args)),
  };
  async function transaction(task, exclusive) {
    assert.equal(active, false, 'no se permiten transacciones anidadas');
    // expo-sqlite abre la conexión exclusiva SIN `PRAGMA foreign_keys = ON` (es por conexión):
    // ahí un DELETE de eventos no hace cascada sobre `reminders`. El pragma es no-op dentro
    // de una transacción, así que se apaga antes del BEGIN y se restaura al terminar.
    if (exclusive) db.exec('PRAGMA foreign_keys = OFF');
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
      if (exclusive) db.exec('PRAGMA foreign_keys = ON');
    }
  }
  return {
    adapter: {
      ...executor,
      execAsync: async (sql) => db.exec(sql),
      withTransactionAsync: (task) => transaction(task, false),
      withExclusiveTransactionAsync: (task) => transaction(task, true),
    },
    reset: (position = null) => { writes = 0; cut = position; },
    state: () => ({ active, writes }),
  };
}

function loadModules({ adapter, platform, native }) {
  const modules = new Map();
  function load(name) {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-sqlite') return { openDatabaseAsync: async () => adapter };
    if (name === 'expo-constants') {
      return {
        __esModule: true, // sin esto TypeScript (esModuleInterop) envuelve el doble y `default` deja de ser el objeto
        default: { executionEnvironment: 'bare' },
        ExecutionEnvironment: { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' },
      };
    }
    if (name === 'expo-notifications') return native.api;
    if (!name.startsWith('@/')) return require(name);
    const filename = path.join(root, 'src', `${name.slice(2)}.ts`);
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    compile(filename)(load, module, module.exports);
    return module.exports;
  }
  return load;
}

function snapshot(db) {
  const data = {};
  for (const { name } of db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all()) {
    assert.match(name, /^[a-z_]+$/);
    data[name] = db.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all();
  }
  return JSON.parse(JSON.stringify(data));
}

const plain = (value) => JSON.parse(JSON.stringify(value));

async function withClock(when, task) {
  mock.timers.enable({ apis: ['Date'], now: when });
  try {
    return await task();
  } finally {
    mock.timers.reset();
  }
}

async function fixture(platform = 'android') {
  const db = new DatabaseSync(':memory:');
  const control = adapterFor(db);
  const native = createNative();
  const load = loadModules({ adapter: control.adapter, platform, native });
  await load('@/db/database').initDatabase();
  const actions = load('@/store/events-slice');
  const store = configureStore({ reducer: { events: actions.default } });
  const f = {
    db,
    control,
    native,
    load,
    store,
    actions,
    repo: load('@/db/events-repo'),
    notifications: load('@/notifications/notifications'),
    reconcile: load('@/notifications/reconcile'),
    dbIds: () => db.prepare('SELECT notification_id AS id FROM reminders WHERE notification_id IS NOT NULL').all()
      .map((row) => row.id).sort(),
    rows: (eventId) => plain(db.prepare('SELECT * FROM reminders WHERE event_id = ? ORDER BY id').all(eventId)),
    stamp: () => db.prepare("SELECT value FROM settings WHERE key = 'reminderContract'").get()?.value ?? null,
  };
  control.reset();
  return f;
}

const base = {
  type: 'cumpleanos', time: '10:00', description: null, contactId: null, phone: null,
  yearly: 1, isMine: 0, photoUri: null, yearUnknown: 0, tags: [],
};
const ev = (title, date, overrides = {}) => ({ ...base, title, date, reminders: [], ...overrides });
const pad = (n) => String(n).padStart(2, '0');
const NOW = new Date(2027, 0, 1, 8, 0, 0);

// ---------------------------------------------------------------------------
// Criterio 1: month 0..11, enero, diciembre y fines de mes.
// ---------------------------------------------------------------------------

test('el validador real de Expo 57 rechaza el contrato viejo (month 1-12) y acepta 0-11', async () => {
  const f = await fixture();
  try {
    const { scheduleNotificationAsync, SchedulableTriggerInputTypes } = f.native.api;
    const yearly = (month, day) => ({
      content: { title: 'x' },
      trigger: { type: SchedulableTriggerInputTypes.YEARLY, month, day, hour: 10, minute: 0 },
    });
    // 15/12 con el contrato viejo (11 + 1 = 12) y 31/1 (0 + 1 = 1, febrero 31): ambos lanzaban.
    await assert.rejects(scheduleNotificationAsync(yearly(12, 15)), { name: 'RangeError', message: /month parameter needs to be between 0 and 11/ });
    await assert.rejects(scheduleNotificationAsync(yearly(1, 31)), { name: 'RangeError', message: /day parameter for month 1/ });
    await assert.rejects(scheduleNotificationAsync(yearly(-1, 15)), { name: 'RangeError' });
    // Contrato 2: diciembre = 11, enero = 0.
    assert.equal(typeof await scheduleNotificationAsync(yearly(11, 15)), 'string');
    assert.equal(typeof await scheduleNotificationAsync(yearly(0, 31)), 'string');
  } finally { f.db.close(); }
});

for (const year of [2027, 2028]) {
  test(`barrido ${year}: los 366 días x 3 avisos producen un YEARLY válido con el mes correcto`, async () => {
    await withClock(new Date(year, 0, 1, 0, 0), async () => {
      const f = await fixture();
      try {
        const leap = new Date(year, 1, 29).getMonth() === 1;
        const seen = new Map();
        for (let month = 0; month < 12; month += 1) {
          const days = new Date(2000, month + 1, 0).getDate(); // 2000 es bisiesto: existe el 29/2
          for (let day = 1; day <= days; day += 1) {
            const date = `2000-${pad(month + 1)}-${pad(day)}`;
            const reminders = await f.notifications.scheduleEventReminders({
              title: date, type: 'cumpleanos', date, time: '10:00', description: null, yearly: 1,
              reminders: [{ amount: 0, unit: 'minutos' }, { amount: 1, unit: 'dias' }, { amount: 1, unit: 'meses' }],
            });
            const occurrenceDay = month === 1 && day === 29 && !leap ? 28 : day;
            const occurrence = new Date(year, month, occurrenceDay, 10, 0);
            const expected = [
              occurrence,
              new Date(occurrence.getTime() - 24 * 60 * 60 * 1000),
              new Date(year, month - 1, Math.min(occurrenceDay, new Date(year, month, 0).getDate()), 10, 0),
            ];
            reminders.forEach((reminder, index) => {
              const trigger = f.native.trigger(reminder.notificationId);
              assert.deepEqual(
                { type: trigger.type, month: trigger.month, day: trigger.day, hour: trigger.hour, minute: trigger.minute },
                { type: 'yearly', month: expected[index].getMonth(), day: expected[index].getDate(), hour: 10, minute: 0 },
                `${date} aviso ${index}`,
              );
            });
            seen.set(date, reminders.map((r) => f.native.trigger(r.notificationId)));
          }
        }
        // Los casos nombrados por el ticket, explícitos para que no dependan del barrido.
        assert.deepEqual([seen.get('2000-01-31')[0].month, seen.get('2000-01-31')[0].day], [0, 31]);
        assert.deepEqual([seen.get('2000-12-15')[0].month, seen.get('2000-12-15')[0].day], [11, 15]);
        assert.deepEqual([seen.get('2000-10-15')[0].month, seen.get('2000-10-15')[0].day], [9, 15]);
        assert.equal(f.native.ids().length, 366 * 3);
      } finally { f.db.close(); }
    });
  });
}

// ---------------------------------------------------------------------------
// Criterio 2: reconciliación de avisos programados bajo el contrato viejo.
// ---------------------------------------------------------------------------

/** BD y SO tal como los dejó la versión con el contrato 1 (sin marca en settings). */
async function legacyFixture(platform = 'android') {
  const f = await fixture(platform);
  const yearly = (month, day) => ({ type: 'yearly', month, day, hour: 10, minute: 0 });
  // El contrato 1 mandaba month 1-12: el 15/10 quedó programado para noviembre.
  f.native.seed('legacy-oct-1', yearly(10, 15));
  f.native.seed('legacy-oct-2', yearly(10, 14));
  f.native.seed('legacy-date', { type: 'date', timestamp: new Date(2027, 4, 31, 10).getTime() });
  f.events = {
    oct: await f.repo.insertEvent(ev('Octubre', '2000-10-15'), [
      { amount: 0, unit: 'minutos', notificationId: 'legacy-oct-1' },
      { amount: 1, unit: 'dias', notificationId: 'legacy-oct-2' },
    ]),
    // 15/12 y 31/1 lanzaban RangeError: esos avisos nunca llegaron a existir (id null).
    dec: await f.repo.insertEvent(ev('Diciembre', '2000-12-15'), [{ amount: 1, unit: 'dias', notificationId: null }]),
    jan: await f.repo.insertEvent(ev('Enero', '2000-01-31'), [{ amount: 0, unit: 'minutos', notificationId: null }]),
    once: await f.repo.insertEvent(ev('Único', '2027-06-01', { yearly: 0 }), [
      { amount: 1, unit: 'dias', notificationId: 'legacy-date' },
    ]),
    none: await f.repo.insertEvent(ev('Sin avisos', '2000-05-05'), []),
  };
  f.control.reset();
  return f;
}

const LEGACY_IDS = ['legacy-oct-1', 'legacy-oct-2'];

/** Disparador de cada aviso de un evento, leído del SO a través del id que quedó en la BD. */
function triggersOf(f, eventId) {
  return f.rows(eventId).map((row) => f.native.trigger(row.notification_id));
}

function assertNoOrphans(f, message) {
  // Todo lo que el SO tiene programado está referenciado por la BD (nadie se queda sin dueño).
  const referenced = new Set(f.dbIds());
  for (const id of f.native.ids()) assert.ok(referenced.has(id), `${message}: ${id} quedó huérfano`);
}

function assertConverged(f, expectedCount) {
  assert.deepEqual(f.native.ids(), f.dbIds(), 'el SO y la BD tienen exactamente los mismos avisos');
  assert.equal(f.native.ids().length, expectedCount, 'sin duplicados ni faltantes');
  for (const id of LEGACY_IDS) assert.equal(f.native.trigger(id), undefined, `${id} ya no existe`);
}

test('reconciliación: reprograma el contrato viejo con el mes correcto, sin duplicar, y es idempotente', () => withClock(NOW, async () => {
  const f = await legacyFixture();
  try {
    assert.equal(f.stamp(), null);
    const onceBefore = f.rows(f.events.once.id);
    const report = await f.reconcile.reconcileReminders();
    assert.equal(report.status, 'migrated');
    assert.equal(report.migrated, 3); // oct, dec, jan; ni el evento sin avisos ni el único (DATE) se tocan
    assert.equal(f.stamp(), String(f.notifications.REMINDER_CONTRACT_VERSION));
    assertConverged(f, 5);

    const pick = (trigger) => [trigger.type, trigger.month, trigger.day, trigger.hour, trigger.minute];
    assert.deepEqual(triggersOf(f, f.events.oct.id).map(pick), [['yearly', 9, 15, 10, 0], ['yearly', 9, 14, 10, 0]]);
    assert.deepEqual(triggersOf(f, f.events.dec.id).map(pick), [['yearly', 11, 14, 10, 0]]);
    assert.deepEqual(triggersOf(f, f.events.jan.id).map(pick), [['yearly', 0, 31, 10, 0]]);
    // El aviso puntual (DATE) no es del contrato YEARLY: ni se reprograma ni se cancela.
    assert.deepEqual(f.rows(f.events.once.id), onceBefore);
    assert.deepEqual(f.native.trigger('legacy-date'), { type: 'date', timestamp: new Date(2027, 4, 31, 10).getTime() });
    assert.ok(!f.native.log.includes('cancel:legacy-date'));
    assert.deepEqual(f.rows(f.events.none.id), []);

    // Segunda ejecución (siguiente arranque): no programa ni cancela nada.
    const calls = f.native.state.scheduleCalls;
    const before = f.native.snapshot();
    const beforeDb = snapshot(f.db);
    assert.deepEqual(await f.reconcile.reconcileReminders(), { status: 'current' });
    assert.equal(f.native.state.scheduleCalls, calls);
    assert.deepEqual(f.native.snapshot(), before);
    assert.deepEqual(snapshot(f.db), beforeDb);
  } finally { f.db.close(); }
}));

test('reconciliación: dos arranques en paralelo (StrictMode) comparten una sola ejecución', () => withClock(NOW, async () => {
  const f = await legacyFixture();
  try {
    const [first, second] = await Promise.all([f.reconcile.reconcileReminders(), f.reconcile.reconcileReminders()]);
    assert.equal(first, second);
    assert.equal(f.native.state.scheduleCalls, 4); // oct x2, dec, jan: el evento único no se reprograma
    assertConverged(f, 5);
  } finally { f.db.close(); }
}));

test('reconciliación: sin scheduler nativo (web / Expo Go) no programa ni marca nada', () => withClock(NOW, async () => {
  const f = await legacyFixture('web');
  try {
    const before = snapshot(f.db);
    assert.deepEqual(await f.reconcile.reconcileReminders(), { status: 'unavailable' });
    assert.equal(f.native.state.scheduleCalls, 0);
    assert.equal(f.stamp(), null);
    assert.deepEqual(snapshot(f.db), before);
  } finally { f.db.close(); }
}));

// Un fallo de reprogramación no puede marcar el contrato como aplicado, no puede dejar
// avisos nuevos sin dueño, y el siguiente arranque converge sin duplicar.
for (let k = 1; k <= 4; k += 1) {
  test(`reconciliación: el SO rechaza programar la llamada ${k}; el reintento converge`, () => withClock(NOW, async () => {
    const f = await legacyFixture();
    try {
      const before = plain(snapshot(f.db).reminders);
      f.native.state.failScheduleAt = k;
      const report = await f.reconcile.reconcileReminders();
      assert.equal(report.status, 'incomplete');
      assert.equal(report.failed.length, 1);
      assert.equal(f.stamp(), null, 'no se marca el contrato si quedó algo pendiente');
      assertNoOrphans(f, 'tras el fallo');

      // El evento fallido conserva sus filas y sus avisos viejos siguen activos (no se canceló nada).
      const failed = f.rows(report.failed[0].eventId);
      assert.deepEqual(failed, before.filter((row) => row.event_id === report.failed[0].eventId));
      for (const row of failed) if (row.notification_id) assert.ok(f.native.trigger(row.notification_id));

      f.native.clearFailures();
      assert.equal((await f.reconcile.reconcileReminders()).status, 'migrated');
      assert.equal(f.stamp(), String(f.notifications.REMINDER_CONTRACT_VERSION));
      assertConverged(f, 5);
    } finally { f.db.close(); }
  }));
}

test('reconciliación: si el SO no cancela un aviso viejo se deshacen los nuevos y el reintento converge', () => withClock(NOW, async () => {
  const f = await legacyFixture();
  try {
    f.native.state.failCancelIds.add('legacy-oct-1');
    const report = await f.reconcile.reconcileReminders();
    assert.equal(report.status, 'incomplete');
    assert.deepEqual(report.failed.map((item) => item.eventId), [f.events.oct.id]);
    assert.equal(f.stamp(), null);
    assertNoOrphans(f, 'tras el fallo de cancelación');
    assert.ok(f.native.trigger('legacy-oct-1'), 'el aviso que el SO se negó a cancelar sigue referenciado por la BD');
    // Los demás eventos sí quedaron migrados: un evento problemático no bloquea al resto.
    assert.equal(report.migrated, 2); // dec y jan; el único (DATE) no entra en la reconciliación

    f.native.clearFailures();
    assert.equal((await f.reconcile.reconcileReminders()).status, 'migrated');
    assertConverged(f, 5);
  } finally { f.db.close(); }
}));

for (const cut of [1, 2]) {
  test(`reconciliación: falla SQLite tras la escritura ${cut} del evento; rollback, sin huérfanos y el reintento converge`, () => withClock(NOW, async () => {
    const f = await legacyFixture();
    try {
      const before = f.rows(f.events.oct.id);
      f.control.reset(cut);
      const report = await f.reconcile.reconcileReminders();
      assert.equal(report.status, 'incomplete');
      assert.deepEqual(report.failed.map((item) => item.eventId), [f.events.oct.id]);
      assert.equal(report.failed[0].error, failure);
      assert.deepEqual(f.rows(f.events.oct.id), before, 'rollback: las filas del evento no cambiaron');
      assert.equal(f.stamp(), null);
      assertNoOrphans(f, 'tras el fallo de SQLite');
      assert.equal(f.control.state().active, false);

      f.control.reset();
      assert.equal((await f.reconcile.reconcileReminders()).status, 'migrated');
      assertConverged(f, 5);
    } finally { f.db.close(); }
  }));
}

test('reconciliación: una edición hecha durante la corrida no se pisa y se respeta en el reintento', () => withClock(NOW, async () => {
  const f = await legacyFixture();
  try {
    const [firstRow] = f.rows(f.events.oct.id);
    f.native.state.onSchedule = async (n) => {
      if (n === 1) f.db.prepare('UPDATE reminders SET amount = 5 WHERE id = ?').run(firstRow.id);
    };
    const report = await f.reconcile.reconcileReminders();
    assert.equal(report.status, 'incomplete');
    assert.match(report.failed[0].error.message, /cambiaron durante la reconciliación/);
    assert.equal(f.rows(f.events.oct.id)[0].amount, 5, 'la edición concurrente se conserva');
    assertNoOrphans(f, 'tras el cambio concurrente');

    f.native.clearFailures();
    assert.equal((await f.reconcile.reconcileReminders()).status, 'migrated');
    assertConverged(f, 5);
    // 5 minutos antes del 15/10 10:00 => 09:55.
    const [trigger] = triggersOf(f, f.events.oct.id);
    assert.deepEqual([trigger.month, trigger.day, trigger.hour, trigger.minute], [9, 15, 9, 55]);
  } finally { f.db.close(); }
}));

// ---------------------------------------------------------------------------
// Criterio 5 (decisión): la reconciliación NO reprograma cada año los 29/2.
// ---------------------------------------------------------------------------

test('decisión 29/2: con el contrato vigente, cambiar de año no reprograma nada', async () => {
  await withClock(new Date(2027, 2, 1, 8, 0), async () => {
    const f = await fixture();
    try {
      assert.equal((await f.reconcile.reconcileReminders()).status, 'migrated'); // arranque 1: BD vacía, deja la marca
      const leapDay = await f.store.dispatch(f.actions.addEvent(
        ev('Bisiesto', '2000-02-29', { reminders: [{ amount: 0, unit: 'minutos' }] }),
      )).unwrap();
      const [id] = leapDay.reminders.map((r) => r.notificationId);
      // Tras el 28/2/2027 la próxima ocurrencia es el 29/2/2028 y se programa con month 1 / day 29.
      assert.deepEqual([f.native.trigger(id).month, f.native.trigger(id).day], [1, 29]);

      const before = f.native.snapshot();
      const calls = f.native.state.scheduleCalls;
      for (const when of [new Date(2028, 2, 1, 8, 0), new Date(2029, 0, 15, 8, 0), new Date(2029, 2, 1, 8, 0)]) {
        mock.timers.setTime(when.getTime());
        assert.deepEqual(await f.reconcile.reconcileReminders(), { status: 'current' });
      }
      assert.equal(f.native.state.scheduleCalls, calls, 'no se reprograma por cambio de año');
      assert.deepEqual(f.native.snapshot(), before, 'el trigger YEARLY queda fijo (límite residual documentado)');
    } finally { f.db.close(); }
  });
});

// ---------------------------------------------------------------------------
// Criterios 3 y 4: editar y borrar con fallos de persistencia.
// ---------------------------------------------------------------------------

const editOriginal = ev('Cumple', '2000-12-15', {
  reminders: [{ amount: 1, unit: 'dias' }, { amount: 1, unit: 'meses' }],
});
const editChanged = {
  ...editOriginal,
  title: 'Editado',
  date: '2000-01-31',
  reminders: [{ amount: 2, unit: 'horas' }, { amount: 0, unit: 'minutos' }, { amount: 1, unit: 'semanas' }],
};

async function editFixture() {
  const f = await fixture();
  f.first = await f.store.dispatch(f.actions.addEvent(editOriginal)).unwrap();
  f.control.reset();
  f.oldIds = f.first.reminders.map((reminder) => reminder.notificationId);
  return f;
}

const edit = (f, data = editChanged) => f.store.dispatch(
  f.actions.editEvent({ id: f.first.id, data, previousReminders: f.first.reminders }),
);

test('crear un evento del 15/12 programa month 11 y 10 (antes lanzaba RangeError)', () => withClock(NOW, async () => {
  const f = await editFixture();
  try {
    const triggers = f.oldIds.map((id) => f.native.trigger(id));
    assert.deepEqual(triggers.map((t) => [t.month, t.day]), [[11, 14], [10, 15]]);
    assert.deepEqual(f.native.ids(), f.dbIds());
  } finally { f.db.close(); }
}));

test('editar: cancela los avisos viejos sólo DESPUÉS de persistir y deja exactamente los nuevos', () => withClock(NOW, async () => {
  const f = await editFixture();
  try {
    const observed = [];
    f.native.state.onCancel = () => observed.push({ db: f.dbIds(), events: f.db.prepare('SELECT title FROM events').all().map((r) => r.title) });
    const saved = await edit(f).unwrap();

    const newIds = saved.reminders.map((reminder) => reminder.notificationId).sort();
    assert.equal(newIds.length, 3);
    assert.deepEqual(f.native.ids(), newIds, 'el SO tiene exactamente los avisos nuevos');
    assert.deepEqual(f.dbIds(), newIds);
    for (const id of f.oldIds) assert.equal(f.native.trigger(id), undefined, `${id} cancelado`);
    // En el momento de cancelar cada aviso viejo, la BD ya tenía el evento editado con los ids nuevos.
    assert.equal(observed.length, 2);
    for (const seen of observed) assert.deepEqual(seen, { db: newIds, events: ['Editado'] });
    // Orden global: todos los schedule van antes que cualquier cancel.
    const lastSchedule = f.native.log.findLastIndex((entry) => entry.startsWith('schedule:'));
    const firstCancel = f.native.log.findIndex((entry) => entry.startsWith('cancel:'));
    assert.ok(lastSchedule < firstCancel);

    // 31/1: 2 h antes (08:00), en el momento (10:00) y 1 semana antes (24/1).
    const pick = (id) => [f.native.trigger(id).month, f.native.trigger(id).day, f.native.trigger(id).hour];
    assert.deepEqual(saved.reminders.map((r) => pick(r.notificationId)), [[0, 31, 8], [0, 31, 10], [0, 24, 10]]);
    assert.equal(f.store.getState().events.items[0].title, 'Editado');
  } finally { f.db.close(); }
}));

test('editar: el SO rechaza programar un reemplazo; los avisos anteriores siguen activos y nada queda huérfano', () => withClock(NOW, async () => {
  const f = await editFixture();
  try {
    const beforeDb = snapshot(f.db);
    const beforeNative = f.native.snapshot();
    const beforeStore = f.store.getState();
    f.native.state.failScheduleAt = f.native.state.scheduleCalls + 2; // el 2º de los 3 nuevos
    await assert.rejects(edit(f).unwrap(), { message: 'El SO rechazó programar el aviso' });
    assert.deepEqual(snapshot(f.db), beforeDb);
    assert.deepEqual(f.native.snapshot(), beforeNative, 'el primer reemplazo se canceló y los viejos siguen activos');
    assert.deepEqual(f.store.getState(), beforeStore);

    await edit(f).unwrap();
    assert.deepEqual(f.native.ids(), f.dbIds());
    assert.equal(f.native.ids().length, 3);
  } finally { f.db.close(); }
}));

test('editar: si SQLite falla en CUALQUIER escritura, los avisos anteriores siguen activos y no quedan huérfanos', async (t) => {
  const total = await withClock(NOW, async () => {
    const baseline = await editFixture();
    try {
      await edit(baseline).unwrap();
      return baseline.control.state().writes;
    } finally { baseline.db.close(); }
  });
  assert.ok(total >= 4, 'se ejercitan evento, avisos y relaciones');
  for (let cut = 1; cut <= total; cut += 1) {
    await t.test(`fallo después de la escritura ${cut}/${total}`, () => withClock(NOW, async () => {
      const f = await editFixture();
      try {
        const beforeDb = snapshot(f.db);
        const beforeNative = f.native.snapshot();
        const beforeStore = f.store.getState();
        f.control.reset(cut);
        await assert.rejects(edit(f).unwrap(), { message: failure.message });
        assert.deepEqual(snapshot(f.db), beforeDb, 'rollback completo');
        assert.deepEqual(f.native.snapshot(), beforeNative, 'avisos anteriores intactos y reemplazos cancelados');
        assert.deepEqual(f.store.getState(), beforeStore);
        assert.equal(f.control.state().active, false);

        f.control.reset();
        const saved = await edit(f).unwrap();
        const newIds = saved.reminders.map((reminder) => reminder.notificationId).sort();
        assert.deepEqual(f.native.ids(), newIds);
        assert.deepEqual(f.dbIds(), newIds);
      } finally { f.db.close(); }
    }));
  }
});

test('editar: si la edición ya se guardó y el SO no cancela un aviso viejo, no se revierte y queda constancia', () => withClock(NOW, async () => {
  const f = await editFixture();
  const warn = mock.method(console, 'warn', () => undefined);
  try {
    const [stuck] = f.oldIds;
    f.native.state.failCancelIds.add(stuck);
    const saved = await edit(f).unwrap();

    assert.equal(saved.title, 'Editado');
    assert.equal(f.store.getState().events.items[0].title, 'Editado');
    assert.deepEqual(f.dbIds(), saved.reminders.map((r) => r.notificationId).sort());
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), new RegExp(stuck));
    // Límite conocido: el SO se negó a cancelar `stuck` y la BD ya no lo referencia.
    assert.ok(f.native.trigger(stuck));
  } finally {
    warn.mock.restore();
    f.db.close();
  }
}));

test('borrar: confirma SQLite y recién entonces cancela los avisos del evento', () => withClock(NOW, async () => {
  const f = await editFixture();
  try {
    const observed = [];
    f.native.state.onCancel = () => observed.push(f.db.prepare('SELECT COUNT(*) AS n FROM events').get().n);
    await f.store.dispatch(f.actions.removeEvent(f.first)).unwrap();
    assert.deepEqual(observed, [0, 0], 'al cancelar, el evento ya no existe en la BD');
    assert.deepEqual(f.native.ids(), []);
    assert.deepEqual(f.dbIds(), []);
    assert.deepEqual(f.store.getState().events.items, []);
  } finally { f.db.close(); }
}));

test('borrar: si SQLite falla, el evento y sus avisos siguen intactos y se puede reintentar', () => withClock(NOW, async () => {
  const f = await editFixture();
  try {
    const beforeDb = snapshot(f.db);
    const beforeNative = f.native.snapshot();
    const beforeStore = f.store.getState();
    f.control.reset(1);
    await assert.rejects(f.store.dispatch(f.actions.removeEvent(f.first)).unwrap(), { message: failure.message });
    assert.deepEqual(snapshot(f.db), beforeDb);
    assert.deepEqual(f.native.snapshot(), beforeNative, 'los avisos siguen activos');
    assert.deepEqual(f.store.getState(), beforeStore);
    assert.equal(f.control.state().active, false);

    f.control.reset();
    await f.store.dispatch(f.actions.removeEvent(f.first)).unwrap();
    assert.deepEqual(f.native.ids(), []);
    assert.deepEqual(f.dbIds(), []);
  } finally { f.db.close(); }
}));

test('borrar: si el SO no cancela tras confirmar el borrado, el evento se va igual y queda constancia', () => withClock(NOW, async () => {
  const f = await editFixture();
  const warn = mock.method(console, 'warn', () => undefined);
  try {
    f.native.state.failCancelIds.add(f.oldIds[0]);
    await f.store.dispatch(f.actions.removeEvent(f.first)).unwrap();
    assert.deepEqual(f.store.getState().events.items, []);
    assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM events').get().n, 0);
    assert.equal(warn.mock.callCount(), 1);
    assert.match(String(warn.mock.calls[0].arguments[0]), new RegExp(f.oldIds[0]));
    assert.deepEqual(f.native.ids(), [f.oldIds[0]], 'sólo queda el aviso que el SO rechazó cancelar');
  } finally {
    warn.mock.restore();
    f.db.close();
  }
}));
