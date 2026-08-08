import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

/**
 * Capa de base de datos local (SQLite).
 *
 * 💡 Aprendizaje: expo-sqlite crea un archivo .db DENTRO del sandbox de la app
 * en el celular. Nadie más puede leerlo (cada app Android/iOS tiene su propio
 * espacio aislado). No hay servidor: la BD vive en el dispositivo, como pediste.
 *
 * Patrón usado: un singleton (una única conexión abierta para toda la app),
 * parecido a un service inyectable de Angular pero a nivel módulo.
 */

let db: SQLite.SQLiteDatabase | null = null;

/** Versión actual del esquema. Al agregar tablas/columnas, subir el número y agregar una migración. */
const DATABASE_VERSION = 6;

export async function initDatabase(): Promise<void> {
  if (db) return; // ya inicializada
  db = await SQLite.openDatabaseAsync('crono.db');
  // SQLite trae las foreign keys APAGADAS por compatibilidad histórica;
  // se activan por conexión para que funcione el ON DELETE CASCADE de reminders.
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
}

/** Acceso a la conexión. Falla rápido si alguien la usa antes de initDatabase(). */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) throw new Error('La base de datos no está inicializada. Llamá a initDatabase() primero.');
  return db;
}

/**
 * Migraciones incrementales usando PRAGMA user_version (patrón oficial de Expo):
 * SQLite guarda un número de versión dentro del propio archivo .db, y acá
 * se aplican solo las migraciones que falten.
 */
async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion >= DATABASE_VERSION) return;

  if (currentVersion === 0) {
    // WAL = write-ahead logging: mejora la concurrencia lectura/escritura.
    // Solo en nativo: el backend WebAssembly de web no soporta WAL.
    if (Platform.OS !== 'web') {
      await database.execAsync(`PRAGMA journal_mode = 'wal'`);
    }

    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        description TEXT,
        reminder_minutes INTEGER,
        yearly INTEGER NOT NULL DEFAULT 0,
        notification_id TEXT
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Tabla clave-valor para preferencias (nombre del usuario, etc.).
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    currentVersion = 1;
  }

  if (currentVersion === 1) {
    // v2: recordatorios múltiples. El aviso único (columnas reminder_minutes /
    // notification_id en events) pasa a una tabla propia: 1 evento → N avisos.
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY NOT NULL,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        minutes INTEGER NOT NULL,
        notification_id TEXT
      );

      -- Backfill: cada evento que tenía UN aviso pasa a tener UNA fila acá.
      INSERT INTO reminders (event_id, minutes, notification_id)
        SELECT id, reminder_minutes, notification_id
        FROM events
        WHERE reminder_minutes IS NOT NULL;

      ALTER TABLE events DROP COLUMN reminder_minutes;
      ALTER TABLE events DROP COLUMN notification_id;
    `);
    currentVersion = 2;
  }

  if (currentVersion === 2) {
    // v3: avisos personalizados. En vez de guardar minutos, se guarda la
    // anticipación tal como la eligió el usuario (cantidad + unidad), porque
    // "1 mes" no equivale a una cantidad fija de minutos.
    await database.execAsync(`
      ALTER TABLE reminders ADD COLUMN amount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE reminders ADD COLUMN unit TEXT NOT NULL DEFAULT 'minutos';

      -- Backfill: los minutos guardados se expresan en la unidad más natural.
      UPDATE reminders SET amount = minutes / 10080, unit = 'semanas' WHERE minutes % 10080 = 0 AND minutes > 0;
      UPDATE reminders SET amount = minutes / 1440,  unit = 'dias'    WHERE minutes % 1440 = 0  AND minutes > 0 AND unit = 'minutos';
      UPDATE reminders SET amount = minutes / 60,    unit = 'horas'   WHERE minutes % 60 = 0    AND minutes > 0 AND unit = 'minutos';
      UPDATE reminders SET amount = minutes,         unit = 'minutos' WHERE minutes > 0 AND unit = 'minutos';

      ALTER TABLE reminders DROP COLUMN minutes;
    `);
    currentVersion = 3;
  }

  if (currentVersion === 3) {
    // v4: los eventos creados desde la agenda de contactos recuerdan de qué
    // contacto salieron (para no cargarlo dos veces) y su teléfono (para
    // saludarlo por WhatsApp sin tener que buscarlo).
    await database.execAsync(`
      ALTER TABLE events ADD COLUMN contact_id TEXT;
      ALTER TABLE events ADD COLUMN phone TEXT;
    `);
    currentVersion = 4;
  }

  if (currentVersion === 4) {
    // v5: "mi cumpleaños" y la lista de quién me saludó cada año.
    await database.execAsync(`
      ALTER TABLE events ADD COLUMN is_mine INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS greetings (
        id INTEGER PRIMARY KEY NOT NULL,
        year INTEGER NOT NULL,
        -- Si la persona está en mi agenda apunta a su cumpleaños; si la anoté
        -- a mano, queda en NULL y solo guardo su nombre.
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT,
        greeted INTEGER NOT NULL DEFAULT 0
      );

      -- Una sola fila por persona y año (índice parcial: solo aplica a los de la agenda).
      CREATE UNIQUE INDEX IF NOT EXISTS greetings_event_year
        ON greetings(year, event_id) WHERE event_id IS NOT NULL;
    `);
    currentVersion = 5;
  }

  if (currentVersion === 5) {
    // v6: antes de crear el índice, se normalizan instalaciones viejas que
    // pudieran tener duplicados. Se conserva el evento más viejo y ningún
    // evento se borra: los demás solo pierden la marca de "propio".
    await database.execAsync(`
      UPDATE events
      SET is_mine = 0
      WHERE is_mine = 1
        AND id NOT IN (SELECT MIN(id) FROM events WHERE is_mine = 1);

      CREATE UNIQUE INDEX IF NOT EXISTS events_single_mine
        ON events(is_mine) WHERE is_mine = 1;
    `);
    currentVersion = 6;
  }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
