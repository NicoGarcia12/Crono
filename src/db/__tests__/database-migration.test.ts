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

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(1);
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

    expect(database.withTransactionAsync).toHaveBeenCalledTimes(2);
    expect(appliedMigrationStatements).toContain('PRAGMA user_version = 2');
  });
});
