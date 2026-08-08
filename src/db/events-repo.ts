import type { SQLiteDatabase, SQLiteRunResult } from 'expo-sqlite';

import { getDb } from '@/db/database';
import { enforceMineBirthday, type EventItem, type EventReminder, type EventType, type NewEvent, type ReminderUnit } from '@/types';

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
}

interface ReminderRow {
  eventId: number;
  amount: number;
  unit: ReminderUnit;
  notificationId: string | null;
}

/** Une los eventos con sus recordatorios (pura, testeable sin BD). */
export function attachReminders(events: EventRow[], reminders: ReminderRow[]): EventItem[] {
  const byEvent = new Map<number, EventReminder[]>();
  for (const reminder of reminders) {
    const list = byEvent.get(reminder.eventId) ?? [];
    list.push({ amount: reminder.amount, unit: reminder.unit, notificationId: reminder.notificationId });
    byEvent.set(reminder.eventId, list);
  }
  return events.map((event) => ({ ...event, reminders: byEvent.get(event.id) ?? [] }));
}

export async function findAllEvents(): Promise<EventItem[]> {
  const db = getDb();
  const events = await db.getAllAsync<EventRow>(
    `SELECT id, title, type, date, time, description, yearly,
            contact_id AS contactId, phone, is_mine AS isMine
     FROM events ORDER BY date ASC`,
  );
  const reminders = await db.getAllAsync<ReminderRow>(
    'SELECT event_id AS eventId, amount, unit, notification_id AS notificationId FROM reminders',
  );
  return attachReminders(events, reminders);
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

export async function updateEvent(event: EventItem): Promise<void> {
  const db = getDb();
  // El helper acepta la forma de creación; al editar preservamos los campos
  // propios de persistencia (id y notificationId de cada recordatorio).
  const enforced = enforceMineBirthday(event);
  const normalized: EventItem = { ...event, type: enforced.type, yearly: enforced.yearly };
  if (normalized.isMine === 0) {
    await writeEvent(db, normalized, normalized.reminders, normalized.id);
    return;
  }

  await clearMine(db, normalized.id);
  await serializeMineWrite(async () => {
    await clearMine(db, normalized.id);
    await writeEvent(db, normalized, normalized.reminders, normalized.id);
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
  db: SQLiteDatabase,
  data: NewEvent,
  reminders: EventReminder[],
  existingId: number | null,
): Promise<EventItem> {
  if (existingId !== null) {
    await db.runAsync(
      `UPDATE events
       SET title = ?, type = ?, date = ?, time = ?, description = ?, yearly = ?,
           contact_id = ?, phone = ?, is_mine = ?
       WHERE id = ?`,
      data.title, data.type, data.date, data.time, data.description, data.yearly,
      data.contactId, data.phone, data.isMine, existingId,
    );
    await db.runAsync('DELETE FROM reminders WHERE event_id = ?', existingId);
    await insertReminders(db, existingId, reminders);
    return { ...data, id: existingId, reminders };
  }

  const result: SQLiteRunResult = await db.runAsync(
    `INSERT INTO events (title, type, date, time, description, yearly, contact_id, phone, is_mine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title, data.type, data.date, data.time, data.description, data.yearly,
    data.contactId, data.phone, data.isMine,
  );
  await insertReminders(db, result.lastInsertRowId, reminders);
  const { reminders: _chosen, ...event } = data;
  return { ...event, id: result.lastInsertRowId, reminders };
}

export async function deleteEvent(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM events WHERE id = ?', id);
}

async function clearMine(db: SQLiteDatabase, exceptId: number | null): Promise<void> {
  if (exceptId === null) {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1');
  } else {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1 AND id != ?', exceptId);
  }
}

async function insertReminders(db: SQLiteDatabase, eventId: number, reminders: EventReminder[]): Promise<void> {
  for (const reminder of reminders) {
    await db.runAsync(
      'INSERT INTO reminders (event_id, amount, unit, notification_id) VALUES (?, ?, ?, ?)',
      eventId, reminder.amount, reminder.unit, reminder.notificationId,
    );
  }
}
