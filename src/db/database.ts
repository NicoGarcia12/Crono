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
const DATABASE_VERSION = 1;

export async function initDatabase(): Promise<void> {
  if (db) return; // ya inicializada
  db = await SQLite.openDatabaseAsync('crono.db');
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

  // Futuras migraciones: if (currentVersion === 1) { ...ALTER TABLE...; currentVersion = 2; }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
