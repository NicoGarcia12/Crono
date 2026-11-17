import { getDb } from '@/db/database';
import { withEventTransaction, type EventExecutor } from '@/db/event-transaction';
import type { NewNote, Note } from '@/types';

/** Repositorio de notas personales. Mismo patrón que events-repo. */

const SELECT_FIELDS = 'id, title, content, created_at AS createdAt, updated_at AS updatedAt';

export async function findAllNotes(db: Pick<EventExecutor, 'getAllAsync'> = getDb()): Promise<Note[]> {
  return db.getAllAsync<Note>(`SELECT ${SELECT_FIELDS} FROM notes ORDER BY updated_at DESC, id DESC`);
}

export async function insertNote(data: NewNote): Promise<Note> {
  const now = new Date().toISOString();
  const result = await withEventTransaction(getDb(), (db) => db.runAsync(
    'INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
    data.title,
    data.content,
    now,
    now,
  ), 'primary');
  return { ...data, id: result.lastInsertRowId, createdAt: now, updatedAt: now };
}

export async function updateNote(id: number, data: NewNote): Promise<Note> {
  return withEventTransaction(getDb(), async (db) => {
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
      data.title,
      data.content,
      now,
      id,
    );
    const updated = await db.getFirstAsync<Note>(`SELECT ${SELECT_FIELDS} FROM notes WHERE id = ?`, id);
    if (!updated) throw new Error(`No existe la nota con id ${id}`);
    return updated;
  }, 'primary');
}

export async function deleteNote(id: number): Promise<void> {
  await withEventTransaction(getDb(), (db) => db.runAsync('DELETE FROM notes WHERE id = ?', id), 'primary');
}
