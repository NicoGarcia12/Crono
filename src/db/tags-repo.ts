import type * as SQLite from 'expo-sqlite';

import { getDb } from '@/db/database';
import type { Tag } from '@/types';

/**
 * Etiquetas libres, muchos a muchos con eventos. Se resuelven por nombre: si
 * "familia" ya existe se reutiliza, si no se crea — el llamador nunca necesita
 * conocer ids de etiqueta.
 */

/** Todas las etiquetas creadas hasta ahora (para autocompletar y para filtrar). */
export async function findAllTags(): Promise<Tag[]> {
  return getDb().getAllAsync<Tag>('SELECT id, name FROM tags ORDER BY name COLLATE NOCASE');
}

export async function findTagsByEvent(eventId: number): Promise<Tag[]> {
  return getDb().getAllAsync<Tag>(
    `SELECT t.id, t.name FROM tags t
     JOIN event_tags et ON et.tag_id = t.id
     WHERE et.event_id = ?
     ORDER BY t.name COLLATE NOCASE`,
    eventId,
  );
}

type Executor = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

/** Normaliza (recorta espacios) y descarta nombres vacíos o repetidos. */
function normalizeNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name.length === 0 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }
  return result;
}

async function getOrCreateTagId(db: Executor, name: string): Promise<number> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM tags WHERE name = ? COLLATE NOCASE',
    name,
  );
  if (existing) return existing.id;

  const result = await db.runAsync('INSERT INTO tags (name) VALUES (?)', name);
  return result.lastInsertRowId;
}

/**
 * Deja las etiquetas del evento exactamente como `names` (crea las que
 * falten, resuelve las que ya existen y saca las que sobran). Se usa tanto al
 * crear como al editar: siempre parte de cero para ese evento.
 */
export async function setEventTags(
  db: Executor,
  eventId: number,
  names: readonly string[],
): Promise<Tag[]> {
  const normalized = normalizeNames(names);
  const ids = await Promise.all(normalized.map((name) => getOrCreateTagId(db, name)));

  await db.runAsync('DELETE FROM event_tags WHERE event_id = ?', eventId);
  for (const id of ids) {
    await db.runAsync('INSERT INTO event_tags (event_id, tag_id) VALUES (?, ?)', eventId, id);
  }

  return normalized.map((name, index) => ({ id: ids[index], name }));
}
