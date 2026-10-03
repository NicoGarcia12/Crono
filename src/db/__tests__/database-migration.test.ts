import type { SQLiteDatabase } from 'expo-sqlite';

type MigrationDatabaseDouble = {
  getFirstAsync: jest.Mock<Promise<{ user_version: number }>, [string]>;
  execAsync: jest.Mock<Promise<void>, [string]>;
  withTransactionAsync: jest.Mock<Promise<void>, [() => Promise<void>]>;
};

const mockOpenDatabaseAsync = jest.fn<Promise<SQLiteDatabase>, [string]>();

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: mockOpenDatabaseAsync,
}));

describe('migración de recordatorios v1 a v2', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('delega el backfill de datos existentes a una transacción de Expo', async () => {
    const database: MigrationDatabaseDouble = {
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
      execAsync: jest.fn().mockResolvedValue(undefined),
      // El mock ejecuta el callback igual que Expo; la API nativa decide luego
      // si confirma o revierte según el resultado de esa Promise.
      withTransactionAsync: jest.fn(async (task) => task()),
    };
    // El módulo usa sólo estas operaciones durante la migración; el adaptador
    // evita inventar métodos nativos que este test no ejercita.
    mockOpenDatabaseAsync.mockResolvedValue(database as unknown as SQLiteDatabase);

    // Jest 29 ejecuta esta suite como CommonJS; require evita habilitar el flag
    // experimental de módulos VM sólo para aislar el singleton de base de datos.
    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await initDatabase();

    // v1→v2, v11→v12, v12→v13 y v13→v14 son las migraciones transaccionales.
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(4);
    expect(database.execAsync).toHaveBeenCalledWith('PRAGMA user_version = 2');
  });

  it('revierte el backfill incompleto y lo puede reintentar tras un fallo', async () => {
    let appliedMigrationStatements: string[] = [];
    let failOnce = true;
    const database: MigrationDatabaseDouble = {
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 1 }),
      execAsync: jest.fn(async (sql) => {
        if (sql === 'ALTER TABLE events DROP COLUMN reminder_minutes' && failOnce) {
          failOnce = false;
          throw new Error('Espacio insuficiente');
        }
        appliedMigrationStatements.push(sql);
      }),
      // Doble de integración: conserva un snapshot del esquema simulado y lo
      // restaura si el callback falla, igual que el rollback de Expo SQLite.
      withTransactionAsync: jest.fn(async (task) => {
        const snapshot = [...appliedMigrationStatements];
        try {
          await task();
        } catch (error) {
          appliedMigrationStatements = snapshot;
          throw error;
        }
      }),
    };
    mockOpenDatabaseAsync.mockResolvedValue(database as unknown as SQLiteDatabase);

    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await expect(initDatabase()).rejects.toThrow('Espacio insuficiente');
    expect(appliedMigrationStatements).not.toContain('PRAGMA user_version = 2');

    await initDatabase();

    // 1 intento fallido de v2 + reintento de v2 + v12 + v13 + v14.
    expect(database.withTransactionAsync).toHaveBeenCalledTimes(5);
    expect(appliedMigrationStatements).toContain('PRAGMA user_version = 2');
  });
});

describe('migración de tipos componibles v11 a v12', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  function v11Database() {
    let applied: string[] = [];
    const database: MigrationDatabaseDouble & { applied: () => string[] } = {
      applied: () => applied,
      getFirstAsync: jest.fn().mockResolvedValue({ user_version: 11 }),
      execAsync: jest.fn(async (sql) => {
        applied.push(sql);
      }),
      withTransactionAsync: jest.fn(async (task) => {
        const snapshot = [...applied];
        try {
          await task();
        } catch (error) {
          applied = snapshot;
          throw error;
        }
      }),
    };
    mockOpenDatabaseAsync.mockResolvedValue(database as unknown as SQLiteDatabase);
    return database;
  }

  it('siembra las 5 bases y conecta cada tipo de fábrica con la base de su misma clave', async () => {
    const database = v11Database();
    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await initDatabase();

    const sql = database.applied().join('\n');
    for (const key of ['evento', 'cumpleanos', 'aniversario', 'festivo', 'cita_medica']) {
      expect(sql).toContain(`SELECT '${key}'`);
    }
    expect(sql).toContain('UPDATE event_types SET base_key = key WHERE is_builtin = 1');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS custom_fields');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS event_field_values');
    expect(database.applied()).toContain('PRAGMA user_version = 12');
  });

  it('los tipos que ya había creado el usuario conservan las ideas de regalo', async () => {
    const database = v11Database();
    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await initDatabase();

    expect(database.applied().join('\n')).toMatch(/extra_capabilities = '\["regalos"\]'\s+WHERE is_builtin = 0/);
  });

  it('v13 borra los datos de capacidades que el tipo ya no tiene y agrega año desconocido', async () => {
    const database = v11Database();
    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await initDatabase();

    const sql = database.applied().join('\n');
    expect(sql).toContain('ALTER TABLE events ADD COLUMN year_unknown INTEGER NOT NULL DEFAULT 0');
    expect(sql).toMatch(/DELETE FROM gift_ideas WHERE event_id IN \([\s\S]*'"regalos"'/);
    expect(sql).toMatch(/DELETE FROM greetings_sent WHERE event_id IN \([\s\S]*'"saludado"'/);
    expect(sql).toMatch(/UPDATE events SET phone = NULL WHERE id IN \([\s\S]*'"whatsapp"'/);
    expect(database.applied()).toContain('PRAGMA user_version = 13');
  });

  it('v14 pasa mi cumpleaños a su propio tipo oculto', async () => {
    const database = v11Database();
    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await initDatabase();

    const sql = database.applied().join('\n');
    expect(sql).toContain('ALTER TABLE event_types ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
    expect(sql).toMatch(/SELECT 'mi_cumpleanos', 'Mi cumpleaños'[\s\S]*'cumpleanos', '\[\]', 1/);
    expect(sql).toContain("UPDATE events SET type = 'mi_cumpleanos' WHERE is_mine = 1");
    expect(database.applied()).toContain('PRAGMA user_version = 14');
  });

  it('si falla a mitad de camino no deja nada aplicado y se puede reintentar', async () => {
    const database = v11Database();
    let failOnce = true;
    const original = database.execAsync.getMockImplementation() as (sql: string) => Promise<void>;
    database.execAsync.mockImplementation(async (sql) => {
      if (sql.includes('CREATE TABLE IF NOT EXISTS custom_fields') && failOnce) {
        failOnce = false;
        throw new Error('Disco lleno');
      }
      await original(sql);
    });

    const { initDatabase }: typeof import('@/db/database') = require('@/db/database');
    await expect(initDatabase()).rejects.toThrow('Disco lleno');
    // Solo queda el PRAGMA de conexión (fuera de la transacción); nada de v12.
    expect(database.applied()).toEqual(['PRAGMA foreign_keys = ON']);

    await initDatabase();
    expect(database.applied()).toContain('PRAGMA user_version = 12');
  });
});
