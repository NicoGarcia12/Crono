import { getDb } from '@/db/database';
import { writeEventFieldValues } from '@/db/custom-fields-repo';
import { withEventTransaction, type EventExecutor } from '@/db/event-transaction';
import * as tagsRepo from '@/db/tags-repo';
import type * as SQLite from 'expo-sqlite';
import type {
  EventItem,
  EventReminder,
  EventType,
  NewEvent,
  ReminderInput,
  ReminderUnit,
  Tag,
} from '@/types';
import { enforceMineBirthday } from '@/types';

/** Repositorio: la única capa que traduce eventos y recordatorios a SQL. */

interface EventRow {
  id: number;
  title: string;
  type: EventType;
  date: string;
  time: string | null;
  description: string | null;
  contactId: string | null;
  phone: string | null;
  yearly: 0 | 1;
  isMine: 0 | 1;
  photoUri: string | null;
  yearUnknown: 0 | 1;
}

interface ReminderRow {
  eventId: number;
  amount: number;
  unit: ReminderUnit;
  notificationId: string | null;
}

/** Une los eventos con sus recordatorios (pura, testeable sin BD). */
export function attachReminders(events: EventRow[], reminders: ReminderRow[]): (EventRow & { reminders: EventReminder[] })[] {
  const byEvent = new Map<number, EventReminder[]>();
  for (const reminder of reminders) {
    const list = byEvent.get(reminder.eventId) ?? [];
    list.push({ amount: reminder.amount, unit: reminder.unit, notificationId: reminder.notificationId });
    byEvent.set(reminder.eventId, list);
  }
  return events.map((event) => ({ ...event, reminders: byEvent.get(event.id) ?? [] }));
}

interface EventTagRow {
  eventId: number;
  id: number;
  name: string;
}

/** Une los eventos con sus etiquetas (pura, testeable sin BD). */
export function attachTags<T extends { id: number }>(events: T[], tagRows: EventTagRow[]): (T & { tags: Tag[] })[] {
  const byEvent = new Map<number, Tag[]>();
  for (const row of tagRows) {
    const list = byEvent.get(row.eventId) ?? [];
    list.push({ id: row.id, name: row.name });
    byEvent.set(row.eventId, list);
  }
  return events.map((event) => ({ ...event, tags: byEvent.get(event.id) ?? [] }));
}

export async function findAllEvents(): Promise<EventItem[]> {
  const db = getDb();
  const events = await db.getAllAsync<EventRow>(
    `SELECT id, title, type, date, time, description, yearly,
            contact_id AS contactId, phone, is_mine AS isMine, photo_uri AS photoUri,
            year_unknown AS yearUnknown
     FROM events ORDER BY date ASC`,
  );
  const reminders = await db.getAllAsync<ReminderRow>(
    'SELECT event_id AS eventId, amount, unit, notification_id AS notificationId FROM reminders',
  );
  const tagRows = await db.getAllAsync<EventTagRow>(
    `SELECT et.event_id AS eventId, t.id, t.name FROM event_tags et JOIN tags t ON t.id = et.tag_id`,
  );
  return attachTags(attachReminders(events, reminders), tagRows);
}

export async function insertEvent(data: NewEvent, reminders: EventReminder[]): Promise<EventItem> {
  return withEventTransaction(getDb(), (transaction) =>
    writeEvent(transaction, enforceMineBirthday(data), reminders, null),
  );
}

/**
 * Guarda una selección de cumpleaños de contactos como una única unidad.
 *
 * La importación es distinta de crear eventos manuales: puede reintentarse si
 * SQLite se interrumpe. Por eso busca el `contact_id` dentro de la misma
 * transacción y no confía en la copia de eventos que está en Redux.
 */
export async function insertContactBirthdays(
  events: readonly NewEvent[],
  remindersByEvent: readonly (readonly (ReminderInput | EventReminder)[])[],
): Promise<EventItem[]> {
  if (events.length !== remindersByEvent.length) {
    throw new Error('Cada cumpleaños importado debe conservar sus recordatorios.');
  }
  if (events.some((event) => !event.contactId)) {
    throw new Error('Los cumpleaños importados deben tener un contact_id.');
  }

  const database = getDb();
  const inserted: EventItem[] = [];

  await withEventTransaction(database, async (transaction) => {
    for (const [index, event] of events.entries()) {
      // La consulta se hace en la transacción: también cubre ids duplicados
      // dentro del mismo lote, antes de que haya commit.
      const existing = await transaction.getFirstAsync<{ id: number }>(
        "SELECT id FROM events WHERE contact_id = ? AND type = 'cumpleanos' LIMIT 1",
        event.contactId,
      );
      if (existing) continue;

      // Antes de persistir, un reminder elegido en UI se completa con `null`:
      // después el scheduler puede guardar un id nativo, pero web no tiene uno.
      const reminders = remindersByEvent[index].map((reminder) => ({
        ...reminder,
        notificationId: 'notificationId' in reminder ? reminder.notificationId : null,
      }));
      inserted.push(await writeEvent(transaction, enforceMineBirthday(event), reminders, null));
    }
  });

  return inserted;
}

/**
 * Igual que `insertEvent`, pero para un evento existente: `data` son los
 * campos del formulario (etiquetas por nombre) y `reminders` los avisos ya
 * reprogramados en el SO. Devuelve el evento persistido, con las etiquetas
 * resueltas a sus filas reales — el llamador no arma el resultado a mano.
 */
export async function updateEvent(
  id: number,
  data: NewEvent,
  reminders: EventReminder[],
): Promise<EventItem> {
  return withEventTransaction(getDb(), (transaction) =>
    writeEvent(transaction, enforceMineBirthday(data), reminders, id),
  );
}

async function writeEvent(
  db: EventExecutor,
  data: NewEvent,
  reminders: EventReminder[],
  existingId: number | null,
): Promise<EventItem> {
  // También el cambio de cumpleaños propio debe revertirse si falla una relación.
  if (data.isMine === 1) await clearMine(db, existingId);
  const { reminders: _chosen, tags: _chosenTags, fieldValues, ...event } = data;
  if (existingId !== null) {
    const result = await db.runAsync(
      `UPDATE events
       SET title = ?, type = ?, date = ?, time = ?, description = ?, yearly = ?,
           contact_id = ?, phone = ?, is_mine = ?, photo_uri = ?, year_unknown = ?
       WHERE id = ?`,
      data.title, data.type, data.date, data.time, data.description, data.yearly,
      data.contactId, data.phone, data.isMine, data.photoUri, data.yearUnknown, existingId,
    );
    if (result.changes === 0) throw new Error('El evento ya no existe.');
    await db.runAsync('DELETE FROM reminders WHERE event_id = ?', existingId);
    await insertRemindersWithExecutor(db, existingId, reminders);
    const tags = await tagsRepo.setEventTags(db, existingId, data.tags);
    if (fieldValues !== undefined) await writeEventFieldValues(db, existingId, fieldValues);
    return { ...event, id: existingId, reminders, tags };
  }

  const result: SQLite.SQLiteRunResult = await db.runAsync(
    `INSERT INTO events (title, type, date, time, description, yearly, contact_id, phone, is_mine, photo_uri, year_unknown)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title, data.type, data.date, data.time, data.description, data.yearly,
    data.contactId, data.phone, data.isMine, data.photoUri, data.yearUnknown,
  );
  await insertRemindersWithExecutor(db, result.lastInsertRowId, reminders);
  const tags = await tagsRepo.setEventTags(db, result.lastInsertRowId, data.tags);
  if (fieldValues !== undefined) await writeEventFieldValues(db, result.lastInsertRowId, fieldValues);
  return { ...event, id: result.lastInsertRowId, reminders, tags };
}

/**
 * Tablas que referencian `events(id)` (todas `ON DELETE CASCADE` en el esquema de
 * `database.ts`; `greetings.event_id` es nullable, pero los saludos ligados a un
 * evento caen con él: solo los anotados a mano tienen `event_id` NULL y no se tocan).
 *
 * Se borran a mano porque en nativo la transacción corre en una conexión NUEVA
 * (`withExclusiveTransactionAsync`) que SQLite abre con `foreign_keys = OFF`: el
 * `PRAGMA` de `initDatabase` es por conexión y, además, un `PRAGMA foreign_keys`
 * dentro de una transacción es un no-op. Sin este borrado quedarían filas huérfanas
 * y, como `events.id` no es AUTOINCREMENT, el próximo evento reutilizaría el id y
 * heredaría avisos, etiquetas y valores ajenos. Si el esquema suma una tabla hija,
 * agregarla acá (el harness `test-event-save.cjs` compara esta lista con el esquema).
 */
export const EVENT_CHILD_TABLES = [
  'reminders',
  'event_tags',
  'event_field_values',
  'gift_ideas',
  'greetings',
  'greetings_sent',
] as const;

export async function deleteEvent(id: number): Promise<void> {
  // En web el DELETE también debe esperar: si se ejecuta durante otro BEGIN,
  // su fulfilled podría publicarse antes de que un rollback lo deshaga.
  await withEventTransaction(getDb(), async (transaction) => {
    // Hijos primero y todo en la misma transacción: o se va el evento completo o nada.
    for (const table of EVENT_CHILD_TABLES) {
      await transaction.runAsync(`DELETE FROM ${table} WHERE event_id = ?`, id);
    }
    await transaction.runAsync('DELETE FROM events WHERE id = ?', id);
  });
}

async function clearMine(db: EventExecutor, exceptId: number | null): Promise<void> {
  if (exceptId === null) {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1');
  } else {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1 AND id != ?', exceptId);
  }
}


type SqlWriteExecutor = Pick<SQLite.SQLiteDatabase, 'runAsync'>;

async function insertRemindersWithExecutor(
  database: SqlWriteExecutor,
  eventId: number,
  reminders: readonly EventReminder[],
): Promise<void> {
  for (const reminder of reminders) {
    await database.runAsync(
      'INSERT INTO reminders (event_id, amount, unit, notification_id) VALUES (?, ?, ?, ?)',
      // `Pick` conserva la firma de dos argumentos; Expo SQLite admite este
      // arreglo como bind posicional, igual que los argumentos variádicos.
      [eventId, reminder.amount, reminder.unit, reminder.notificationId],
    );
  }
}

