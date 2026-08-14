import { getDb } from '@/db/database';
import type { Greeting } from '@/types';

/**
 * Repositorio de saludos: quién me saludó en mi cumpleaños, año por año.
 *
 * La fila existe solo cuando hace falta: si nunca tocaste a una persona, no
 * hay registro suyo (y se muestra como "no saludó"). Al tildarla se crea o
 * actualiza la fila de ESE año — por eso la lista se reinicia sola cada año.
 */

const SELECT_FIELDS = 'id, year, event_id AS eventId, name, phone, greeted';

export async function findGreetingsByYear(year: number): Promise<Greeting[]> {
  return getDb().getAllAsync<Greeting>(
    `SELECT ${SELECT_FIELDS} FROM greetings WHERE year = ? ORDER BY name COLLATE NOCASE`,
    year,
  );
}

/** Marca (o desmarca) que una persona de mi agenda me saludó ese año. */
export async function setGreetedForEvent(
  year: number,
  eventId: number,
  name: string,
  phone: string | null,
  greeted: boolean,
): Promise<Greeting> {
  const db = getDb();
  const existing = await db.getFirstAsync<Greeting>(
    `SELECT ${SELECT_FIELDS} FROM greetings WHERE year = ? AND event_id = ?`,
    year,
    eventId,
  );

  const value = greeted ? 1 : 0;

  if (existing) {
    await db.runAsync('UPDATE greetings SET greeted = ? WHERE id = ?', value, existing.id);
    return { ...existing, greeted: value };
  }

  const result = await db.runAsync(
    'INSERT INTO greetings (year, event_id, name, phone, greeted) VALUES (?, ?, ?, ?, ?)',
    year,
    eventId,
    name,
    phone,
    value,
  );
  return { id: result.lastInsertRowId, year, eventId, name, phone, greeted: value };
}

/** Agrega a la lista a alguien que no tengo en la agenda. */
export async function insertGuest(
  year: number,
  name: string,
  phone: string | null,
  greeted: boolean,
): Promise<Greeting> {
  const value = greeted ? 1 : 0;
  const result = await getDb().runAsync(
    'INSERT INTO greetings (year, event_id, name, phone, greeted) VALUES (?, NULL, ?, ?, ?)',
    year,
    name,
    phone,
    value,
  );
  return { id: result.lastInsertRowId, year, eventId: null, name, phone, greeted: value };
}

/** Marca/desmarca a alguien anotado a mano. */
export async function setGreetedById(id: number, greeted: boolean): Promise<void> {
  await getDb().runAsync('UPDATE greetings SET greeted = ? WHERE id = ?', greeted ? 1 : 0, id);
}

/** Cuando a un invitado se le carga el cumpleaños, su fila pasa a apuntar a ese evento. */
export async function linkGuestToEvent(id: number, eventId: number): Promise<void> {
  await getDb().runAsync('UPDATE greetings SET event_id = ? WHERE id = ?', eventId, id);
}

export async function deleteGreeting(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM greetings WHERE id = ?', id);
}
