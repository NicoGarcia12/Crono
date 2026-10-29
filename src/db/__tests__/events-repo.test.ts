import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import { attachReminders, attachTags, deleteEvent, EVENT_CHILD_TABLES, insertEvent } from '@/db/events-repo';
import { getDb } from '@/db/database';
import type { NewEvent } from '@/types';

// Jest no inicia el módulo SQLite nativo; el doble permite observar cuándo
// se escriben las filas dentro de la transacción del repositorio.
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));
// Estas pruebas no usan fotos: sin copias propias, la limpieza posterior no consulta SQLite.
jest.mock('@/media/photos', () => ({ savedPhotos: () => [] }));

const miCumple: NewEvent = {
  title: 'Mi cumpleaños',
  type: 'cumpleanos',
  date: '1990-08-08',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 1,
  tags: [],
  photoUri: null,
  yearUnknown: 0,
};

const runResult = (lastInsertRowId = 0): SQLiteRunResult => ({ lastInsertRowId, changes: 1 });

describe('attachReminders', () => {
  const events = [
    { id: 1, title: 'Mamá', type: 'cumpleanos' as const, date: '1960-08-01', time: null, description: null, contactId: 'c1', phone: '+54 11 5555-0001', yearly: 1 as const, isMine: 0 as const, photoUri: null, yearUnknown: 0 as const },
    { id: 2, title: 'Turno médico', type: 'cita_medica' as const, date: '2026-09-10', time: '10:30', description: null, contactId: null, phone: null, yearly: 0 as const, isMine: 0 as const, photoUri: null, yearUnknown: 0 as const },
  ];

  it('agrupa los avisos por evento (relación 1→N)', () => {
    const reminders = [
      { eventId: 1, amount: 1, unit: 'meses' as const, notificationId: 'n1' },
      { eventId: 1, amount: 1, unit: 'semanas' as const, notificationId: 'n2' },
    ];

    const result = attachReminders(events, reminders);

    expect(result[0].reminders).toEqual([
      { amount: 1, unit: 'meses', notificationId: 'n1' },
      { amount: 1, unit: 'semanas', notificationId: 'n2' },
    ]);
    expect(result[1].reminders).toEqual([]); // sin avisos → lista vacía, nunca undefined
  });

  it('ignora avisos de eventos que no están en la lista', () => {
    const result = attachReminders(events, [
      { eventId: 99, amount: 1, unit: 'horas', notificationId: null },
    ]);

    expect(result.every((e) => e.reminders.length === 0)).toBe(true);
  });
});

describe('attachTags', () => {
  const events = [{ id: 1 }, { id: 2 }];

  it('agrupa las etiquetas por evento', () => {
    const result = attachTags(events, [
      { eventId: 1, id: 10, name: 'familia' },
      { eventId: 1, id: 11, name: 'cumpleaños' },
    ]);

    expect(result[0].tags).toEqual([
      { id: 10, name: 'familia' },
      { id: 11, name: 'cumpleaños' },
    ]);
    expect(result[1].tags).toEqual([]); // sin etiquetas → lista vacía, nunca undefined
  });
});

describe('insertEvent', () => {
  it('mantiene un único cumpleaños propio cuando dos escrituras llegan en paralelo', async () => {
    const rows: Array<{ isMine: 0 | 1 }> = [];
    let clears = 0;

    const runAsync = async (query: string, ...params: unknown[]): Promise<SQLiteRunResult> => {
      if (query.startsWith('UPDATE events SET is_mine = 0')) {
        clears += 1;
        rows.forEach((row) => {
          row.isMine = 0;
        });
        return runResult();
      }

      if (query.startsWith('INSERT INTO events')) {
        // El INSERT termina en (..., is_mine, photo_uri, year_unknown): is_mine es el antepenúltimo bind.
        const isMine = params.at(-3);
        if (isMine !== 0 && isMine !== 1) throw new Error('is_mine inválido');
        rows.push({ isMine });
        return runResult(rows.length);
      }

      // El evento de prueba no trae etiquetas: setEventTags igual limpia la tabla puente.
      if (query.startsWith('DELETE FROM event_tags')) {
        return runResult();
      }

      throw new Error(`SQL inesperado: ${query}`);
    };

    let exclusiveTail = Promise.resolve();
    const database = {
      runAsync,
      async withExclusiveTransactionAsync(
        task: (transaction: { runAsync: typeof runAsync }) => Promise<void>,
      ): Promise<void> {
        const previous = exclusiveTail;
        let release: (() => void) | undefined;
        exclusiveTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          await task({ runAsync });
        } finally {
          release?.();
        }
      },
    };

    // REASON: el repositorio depende de una interfaz nativa grande; este fake sólo implementa
    // los métodos ejercitados por la prueba de concurrencia.
    jest.mocked(getDb).mockReturnValue(database as SQLiteDatabase);

    await Promise.all([insertEvent(miCumple, []), insertEvent({ ...miCumple, date: '1991-08-08' }, [])]);

    expect(rows.filter((row) => row.isMine === 1)).toHaveLength(1);
    expect(clears).toBe(2);
  });
});

describe('deleteEvent', () => {
  // Cuadro del esquema (database.ts): tablas con `REFERENCES events(id) ON DELETE CASCADE`.
  // La transacción exclusiva de nativo corre en una conexión nueva con foreign_keys = OFF,
  // así que ninguna cascada ocurre: el repositorio tiene que borrar las hijas él mismo.
  const hijas = ['reminders', 'event_tags', 'event_field_values', 'gift_ideas', 'greetings', 'greetings_sent'];

  it('borra cada tabla hija y después el evento, todo dentro de la transacción exclusiva', async () => {
    const log: string[] = [];
    let inTransaction = false;
    const mainConnectionRunAsync = jest.fn(async (_query: string, ..._params: unknown[]): Promise<SQLiteRunResult> => runResult());
    const transactionRunAsync = async (query: string, ...params: unknown[]): Promise<SQLiteRunResult> => {
      if (!inTransaction) throw new Error('escritura fuera de la transacción exclusiva');
      log.push(`${query} <- ${JSON.stringify(params)}`);
      return runResult();
    };
    const database = {
      runAsync: mainConnectionRunAsync,
      async withExclusiveTransactionAsync(
        task: (transaction: { runAsync: typeof transactionRunAsync }) => Promise<void>,
      ): Promise<void> {
        inTransaction = true;
        try {
          await task({ runAsync: transactionRunAsync });
        } finally {
          inTransaction = false;
        }
      },
    };
    // REASON: el repositorio depende de una interfaz nativa grande; este fake sólo implementa
    // la transacción exclusiva y la conexión principal que NO debe usarse para borrar.
    jest.mocked(getDb).mockReturnValue(database as unknown as SQLiteDatabase);

    await deleteEvent(42);

    // El evento va al final; el orden entre hijas no importa (todas son ON DELETE CASCADE).
    expect(log.at(-1)).toBe('DELETE FROM events WHERE id = ? <- [42]');
    expect(log.slice(0, -1).sort()).toEqual(
      hijas.map((tabla) => `DELETE FROM ${tabla} WHERE event_id = ? <- [42]`).sort(),
    );
    expect(mainConnectionRunAsync).not.toHaveBeenCalled();
    expect([...EVENT_CHILD_TABLES].sort()).toEqual([...hijas].sort());
  });

  it('si falla un DELETE hijo, propaga el error y no llega a borrar el evento', async () => {
    const log: string[] = [];
    const failing = new Error('SQLITE_BUSY');
    const transactionRunAsync = async (query: string, ..._params: unknown[]): Promise<SQLiteRunResult> => {
      log.push(query);
      if (query.startsWith('DELETE FROM gift_ideas')) throw failing;
      return runResult();
    };
    const database = {
      runAsync: transactionRunAsync,
      async withExclusiveTransactionAsync(
        task: (transaction: { runAsync: typeof transactionRunAsync }) => Promise<void>,
      ): Promise<void> {
        await task({ runAsync: transactionRunAsync });
      },
    };
    // REASON: igual que arriba; sólo se necesita la transacción exclusiva.
    jest.mocked(getDb).mockReturnValue(database as unknown as SQLiteDatabase);

    await expect(deleteEvent(7)).rejects.toBe(failing);
    expect(log.some((query) => query.startsWith('DELETE FROM events'))).toBe(false);
  });
});
