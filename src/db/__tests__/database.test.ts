import type * as SQLite from 'expo-sqlite';

import * as SQLiteModule from 'expo-sqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

describe('initDatabase', () => {
  it('reanuda v3→v4 desde el fixture que ya tiene contact_id y completa phone antes de finalizar las migraciones', async () => {
    const columns = new Set(['contact_id']);
    let userVersion = 3;
    const database: Pick<SQLite.SQLiteDatabase, 'execAsync' | 'getFirstAsync'> = {
      getFirstAsync: jest.fn(async () => ({ user_version: userVersion })),
      execAsync: jest.fn(async (sql: string) => {
        if (sql.includes('ADD COLUMN contact_id') && columns.has('contact_id')) {
          throw new Error('duplicate column name: contact_id');
        }
        if (sql.includes('ADD COLUMN contact_id')) columns.add('contact_id');
        if (sql.includes('ADD COLUMN phone')) columns.add('phone');
        if (sql.includes('PRAGMA user_version = 9')) userVersion = 9;
      }),
    };
    jest
      .mocked(SQLiteModule.openDatabaseAsync)
      // El fixture implementa solamente la superficie SQLite que ejercita initDatabase.
      .mockResolvedValue(database as unknown as SQLite.SQLiteDatabase);

    // Jest 29 + jest-expo transpila este proyecto como CommonJS: requireActual
    // conserva los mocks de expo-sqlite/react-native sin requerir VM Modules.
    const { initDatabase } = jest.requireActual<typeof import('@/db/database')>('@/db/database');

    await initDatabase();

    expect({ columns: [...columns].sort(), userVersion }).toEqual({
      columns: ['contact_id', 'phone'],
      userVersion: 9,
    });
  });
});
