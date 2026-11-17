import { getDb } from '@/db/database';
import { withEventTransaction } from '@/db/event-transaction';
import type { GiftIdea, NewGiftIdea } from '@/types';

/** Repositorio de ideas de regalo. Mismo patrón que notes-repo, filtrado por evento. */

const SELECT_FIELDS = 'id, event_id AS eventId, text, created_at AS createdAt';

export async function findGiftIdeasByEvent(eventId: number): Promise<GiftIdea[]> {
  return getDb().getAllAsync<GiftIdea>(
    `SELECT ${SELECT_FIELDS} FROM gift_ideas WHERE event_id = ? ORDER BY id ASC`,
    eventId,
  );
}

export async function insertGiftIdea(data: NewGiftIdea): Promise<GiftIdea> {
  const now = new Date().toISOString();
  const result = await withEventTransaction(getDb(), (db) => db.runAsync(
    'INSERT INTO gift_ideas (event_id, text, created_at) VALUES (?, ?, ?)',
    data.eventId,
    data.text,
    now,
  ), 'primary');
  return { id: result.lastInsertRowId, eventId: data.eventId, text: data.text, createdAt: now };
}

export async function updateGiftIdeaText(id: number, text: string): Promise<void> {
  await withEventTransaction(getDb(), (db) => db.runAsync('UPDATE gift_ideas SET text = ? WHERE id = ?', text, id), 'primary');
}

export async function deleteGiftIdea(id: number): Promise<void> {
  await withEventTransaction(getDb(), (db) => db.runAsync('DELETE FROM gift_ideas WHERE id = ?', id), 'primary');
}
