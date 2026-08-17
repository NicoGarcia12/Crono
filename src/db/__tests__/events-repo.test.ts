import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import { attachReminders, attachTags, insertEvent } from '@/db/events-repo';
import { getDb } from '@/db/database';
import type { NewEvent } from '@/types';

// El repo importa la conexión SQLite (nativa); acá solo se testea la
// función pura de agrupado, así que alcanza con mockear el módulo de BD.
jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

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
};

const runResult = (lastInsertRowId = 0): SQLiteRunResult => ({ lastInsertRowId, changes: 1 });

describe('attachReminders', () => {
  const events = [
    { id: 1, title: 'Mamá', type: 'cumpleanos' as const, date: '1960-08-01', time: null, description: null, contactId: 'c1', phone: '+54 11 5555-0001', yearly: 1 as const, isMine: 0 as const, photoUri: null },
    { id: 2, title: 'Turno médico', type: 'cita_medica' as const, date: '2026-09-10', time: '10:30', description: null, contactId: null, phone: null, yearly: 0 as const, isMine: 0 as const, photoUri: null },
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
    let releaseBothClears: (() => void) | undefined;
    const bothClearsStarted = new Promise<void>((resolve) => {
      releaseBothClears = resolve;
    });

    const runAsync = async (query: string, ...params: unknown[]): Promise<SQLiteRunResult> => {
      if (query.startsWith('UPDATE events SET is_mine = 0')) {
        clears += 1;
        if (clears === 2) releaseBothClears?.();
        await bothClearsStarted;
        rows.forEach((row) => {
          row.isMine = 0;
        });
        return runResult();
      }

      if (query.startsWith('INSERT INTO events')) {
        // El INSERT termina en (..., is_mine, photo_uri): is_mine es el anteúltimo bind.
        const isMine = params.at(-2);
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
  });
});
