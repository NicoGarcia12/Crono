import { getDb } from '@/db/database';
import type { GreetingSent } from '@/types';

/**
 * Repositorio de "ya lo saludé": para cada cumpleaños/aniversario ajeno,
 * marca año por año si ya le mandé el saludo. Mismo patrón no destructivo
 * que `greetings-repo`, en tabla propia (ver database.ts, migración v8).
 */

const SELECT_FIELDS = 'id, year, event_id AS eventId, greeted';

export async function findGreetingsSentByYear(year: number): Promise<GreetingSent[]> {
  return getDb().getAllAsync<GreetingSent>(
    `SELECT ${SELECT_FIELDS} FROM greetings_sent WHERE year = ?`,
    year,
  );
}

/** Marca (o desmarca) que ya saludé a la persona de ese evento en ese año. */
export async function setGreetingSent(
  year: number,
  eventId: number,
  greeted: boolean,
): Promise<GreetingSent> {
  const db = getDb();
  const existing = await db.getFirstAsync<GreetingSent>(
    `SELECT ${SELECT_FIELDS} FROM greetings_sent WHERE year = ? AND event_id = ?`,
    year,
    eventId,
  );

  const value = greeted ? 1 : 0;

  if (existing) {
    await db.runAsync('UPDATE greetings_sent SET greeted = ? WHERE id = ?', value, existing.id);
    return { ...existing, greeted: value };
  }

  const result = await db.runAsync(
    'INSERT INTO greetings_sent (year, event_id, greeted) VALUES (?, ?, ?)',
    year,
    eventId,
    value,
  );
  return { id: result.lastInsertRowId, year, eventId, greeted: value };
}
