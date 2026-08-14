import type * as SQLite from 'expo-sqlite';

import { getDb } from '@/db/database';
import * as eventsRepo from '@/db/events-repo';
import type { EventItem, EventReminder, NewEvent } from '@/types';

jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

type InsertContactBirthdays = (
  events: readonly NewEvent[],
  reminders: readonly EventReminder[][],
) => Promise<EventItem[]>;

const insertContactBirthdays = (
  eventsRepo as typeof eventsRepo & { insertContactBirthdays?: InsertContactBirthdays }
).insertContactBirthdays;

const contactBirthday = (contactId: string, title: string): NewEvent => ({
  title,
  type: 'cumpleanos',
  date: '1990-01-01',
  time: null,
  description: null,
  contactId,
  phone: null,
  reminders: [{ amount: 1, unit: 'dias' }],
  yearly: 1,
  isMine: 0,
});

/**
 * Fixture de SQLite con commit diferido: sólo publica las filas al completar
 * el callback de la transacción. Modela el rollback nativo que debe usar la
 * importación en Expo SQLite.
 */
function createTransactionalDatabase(failOnceForContactId: string): {
  database: Pick<SQLite.SQLiteDatabase, 'withExclusiveTransactionAsync'>;
  events: { contactId: string; title: string }[];
} {
  const events: { contactId: string; title: string }[] = [];
  let mustFail = true;

  const database: Pick<SQLite.SQLiteDatabase, 'withExclusiveTransactionAsync'> = {
    withExclusiveTransactionAsync: async (task) => {
      const pending = events.map((event) => ({ ...event }));
      const transaction = {
        getFirstAsync: jest.fn(async (_sql: string, ...params: unknown[]) => {
          const contactId = params.find((param): param is string => typeof param === 'string');
          return pending.find((event) => event.contactId === contactId) ?? null;
        }),
        runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
          if (!sql.includes('INSERT INTO events')) return { lastInsertRowId: 0, changes: 1 };

          const [title, , , , , , contactId] = params;
          if (contactId === failOnceForContactId && mustFail) {
            mustFail = false;
            throw new Error('SQLite write interrupted');
          }
          pending.push({ contactId: String(contactId), title: String(title) });
          return { lastInsertRowId: pending.length, changes: 1 };
        }),
      };

      // El doble sólo implementa las operaciones que el contrato de la
      // importación necesita; Expo tipa el callback con la interfaz completa.
      await task(transaction as unknown as SQLite.SQLiteDatabase);
      events.splice(0, events.length, ...pending);
    },
  };

  return { database, events };
}

describe('insertContactBirthdays', () => {
  it('reintenta una importación interrumpida sin persistencia parcial ni cumpleaños duplicados', async () => {
    const fixture = createTransactionalDatabase('contact-2');
    jest
      .mocked(getDb)
      .mockReturnValue(fixture.database as unknown as SQLite.SQLiteDatabase);
    const entries = [contactBirthday('contact-1', 'Ana'), contactBirthday('contact-2', 'Bruno')];
    const reminders = entries.map((event) => event.reminders);

    try {
      await insertContactBirthdays!(entries, reminders);
      throw new Error('La primera importación debía propagar el fallo de SQLite');
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'SQLite write interrupted') throw error;
    }
    await insertContactBirthdays!(entries, reminders);
    await insertContactBirthdays!(entries, reminders);

    expect(fixture.events).toEqual([
      { contactId: 'contact-1', title: 'Ana' },
      { contactId: 'contact-2', title: 'Bruno' },
    ]);
  });
});
