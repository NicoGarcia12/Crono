import { getDb } from '@/db/database';
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
            contact_id AS contactId, phone, is_mine AS isMine, photo_uri AS photoUri
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
  const db = getDb();
  const event = enforceMineBirthday(data);
  if (event.isMine === 0) return writeEvent(db, event, reminders, null);

  // Web no soporta withExclusiveTransactionAsync en Expo. Esta cola corre en
  // el hilo JS y ordena escrituras de esta instancia; el índice único parcial
  // de la migración v6 conserva el invariante entre conexiones distintas.
  await clearMine(db, null);
  return serializeMineWrite(async () => {
    await clearMine(db, null);
    return writeEvent(db, event, reminders, null);
  });
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

  await withImportTransaction(database, async (transaction) => {
    for (const [index, event] of events.entries()) {
      // La consulta se hace en la transacción: también cubre ids duplicados
      // dentro del mismo lote, antes de que haya commit.
      const existing = await transaction.getFirstAsync<{ id: number }>(
        "SELECT id FROM events WHERE contact_id = ? AND type = 'cumpleanos' LIMIT 1",
        event.contactId,
      );
      if (existing) continue;

      const result = await transaction.runAsync(
        `INSERT INTO events (title, type, date, time, description, yearly, contact_id, phone)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        event.title,
        event.type,
        event.date,
        event.time,
        event.description,
        event.yearly,
        event.contactId,
        event.phone,
      );
      // Antes de persistir, un reminder elegido en UI se completa con `null`:
      // después el scheduler puede guardar un id nativo, pero web no tiene uno.
      const reminders = remindersByEvent[index].map((reminder) => ({
        ...reminder,
        notificationId: 'notificationId' in reminder ? reminder.notificationId : null,
      }));
      await insertRemindersWithExecutor(transaction, result.lastInsertRowId, reminders);

      // Los cumpleaños importados no traen etiquetas: se agregan después, a mano.
      const { reminders: _chosen, tags: _chosenTags, ...eventWithoutReminders } = event;
      inserted.push({ ...eventWithoutReminders, id: result.lastInsertRowId, reminders, tags: [] });
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
  const db = getDb();
  const enforced = enforceMineBirthday(data);
  if (enforced.isMine === 0) return writeEvent(db, enforced, reminders, id);

  await clearMine(db, id);
  return serializeMineWrite(async () => {
    await clearMine(db, id);
    return writeEvent(db, enforced, reminders, id);
  });
}

let mineWriteTail: Promise<void> = Promise.resolve();

function serializeMineWrite<T>(task: () => Promise<T>): Promise<T> {
  const previous = mineWriteTail;
  let release: (() => void) | undefined;
  mineWriteTail = new Promise<void>((resolve) => {
    release = resolve;
  });
  return previous.then(task).finally(() => release?.());
}

async function writeEvent(
  db: SQLite.SQLiteDatabase,
  data: NewEvent,
  reminders: EventReminder[],
  existingId: number | null,
): Promise<EventItem> {
  if (existingId !== null) {
    await db.runAsync(
      `UPDATE events
       SET title = ?, type = ?, date = ?, time = ?, description = ?, yearly = ?,
           contact_id = ?, phone = ?, is_mine = ?, photo_uri = ?
       WHERE id = ?`,
      data.title, data.type, data.date, data.time, data.description, data.yearly,
      data.contactId, data.phone, data.isMine, data.photoUri, existingId,
    );
    await db.runAsync('DELETE FROM reminders WHERE event_id = ?', existingId);
    await insertReminders(db, existingId, reminders);
    const tags = await tagsRepo.setEventTags(db, existingId, data.tags);
    return { ...data, id: existingId, reminders, tags };
  }

  const result: SQLite.SQLiteRunResult = await db.runAsync(
    `INSERT INTO events (title, type, date, time, description, yearly, contact_id, phone, is_mine, photo_uri)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title, data.type, data.date, data.time, data.description, data.yearly,
    data.contactId, data.phone, data.isMine, data.photoUri,
  );
  await insertReminders(db, result.lastInsertRowId, reminders);
  const tags = await tagsRepo.setEventTags(db, result.lastInsertRowId, data.tags);
  const { reminders: _chosen, tags: _chosenTags, ...event } = data;
  return { ...event, id: result.lastInsertRowId, reminders, tags };
}

export async function deleteEvent(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM events WHERE id = ?', id);
}

async function clearMine(db: SQLite.SQLiteDatabase, exceptId: number | null): Promise<void> {
  if (exceptId === null) {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1');
  } else {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1 AND id != ?', exceptId);
  }
}

async function insertReminders(
  database: SqlWriteExecutor,
  eventId: number,
  reminders: EventReminder[],
): Promise<void> {
  // Conservamos la misma conexión/transacción del evento para que sus
  // recordatorios no queden escritos desde otra operación de SQLite.
  await insertRemindersWithExecutor(database, eventId, reminders);
}

type SqlWriteExecutor = Pick<SQLite.SQLiteDatabase, 'runAsync'>;
type ImportTransactionExecutor = Pick<SQLite.SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;

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

/**
 * Expo SDK 54+ ofrece transacciones exclusivas en nativo, pero la API no está
 * disponible en web. El fallback sigue siendo atómico; la diferencia es que
 * en web no puede bloquear escrituras async ajenas durante el lote.
 */
async function withImportTransaction(
  database: SQLite.SQLiteDatabase,
  task: (transaction: ImportTransactionExecutor) => Promise<void>,
): Promise<void> {
  const exclusiveDatabase = database as SQLite.SQLiteDatabase & {
    withExclusiveTransactionAsync?: (
      transactionTask: (transaction: SQLite.SQLiteDatabase) => Promise<void>,
    ) => Promise<void>;
  };

  if (typeof exclusiveDatabase.withExclusiveTransactionAsync === 'function') {
    await exclusiveDatabase.withExclusiveTransactionAsync(task);
    return;
  }

  // En web Expo no expone la variante exclusiva. Las consultas se hacen con
  // `database` dentro del callback, como exige withTransactionAsync.
  await database.withTransactionAsync(async () => task(database));
}
