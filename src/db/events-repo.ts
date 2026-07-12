import { getDb } from '@/db/database';
import type { EventItem, EventReminder, EventType, NewEvent, ReminderUnit } from '@/types';

/**
 * Repositorio de eventos: la ÚNICA capa que habla SQL sobre `events` y `reminders`.
 *
 * 💡 Aprendizaje: este patrón "repository" es el mismo que usarías con un
 * backend (Prisma/Sequelize). Las pantallas nunca escriben SQL; pasan por acá
 * a través de los thunks de Redux.
 *
 * Relación 1→N clásica: un evento tiene N recordatorios (tabla `reminders`
 * con FK a events y ON DELETE CASCADE). Se leen con dos queries y se agrupan
 * en memoria — más simple que un JOIN + agrupado a mano, y son pocos datos.
 */

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
  for (const r of reminders) {
    const list = byEvent.get(r.eventId) ?? [];
    list.push({ amount: r.amount, unit: r.unit, notificationId: r.notificationId });
    byEvent.set(r.eventId, list);
  }
  return events.map((e) => ({ ...e, reminders: byEvent.get(e.id) ?? [] }));
}

export async function findAllEvents(): Promise<EventItem[]> {
  const db = getDb();
  const events = await db.getAllAsync<EventRow>(
    `SELECT id, title, type, date, time, description, yearly,
            contact_id AS contactId, phone
     FROM events ORDER BY date ASC`,
  );
  const reminders = await db.getAllAsync<ReminderRow>(
    'SELECT event_id AS eventId, amount, unit, notification_id AS notificationId FROM reminders',
  );
  return attachReminders(events, reminders);
}

export async function insertEvent(data: NewEvent, reminders: EventReminder[]): Promise<EventItem> {
  const db = getDb();
  // Los parámetros SIEMPRE con '?' (binding) — nunca concatenar strings (SQL injection).
  const result = await db.runAsync(
    `INSERT INTO events (title, type, date, time, description, yearly, contact_id, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title,
    data.type,
    data.date,
    data.time,
    data.description,
    data.yearly,
    data.contactId,
    data.phone,
  );
  const eventId = result.lastInsertRowId;
  await insertReminders(eventId, reminders);

  const { reminders: _chosen, ...event } = data;
  return { ...event, id: eventId, reminders };
}

export async function updateEvent(event: EventItem): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `UPDATE events
     SET title = ?, type = ?, date = ?, time = ?, description = ?, yearly = ?,
         contact_id = ?, phone = ?
     WHERE id = ?`,
    event.title,
    event.type,
    event.date,
    event.time,
    event.description,
    event.yearly,
    event.contactId,
    event.phone,
    event.id,
  );
  // Los avisos se reemplazan enteros: los viejos ya fueron cancelados en el thunk.
  await db.runAsync('DELETE FROM reminders WHERE event_id = ?', event.id);
  await insertReminders(event.id, event.reminders);
}

export async function deleteEvent(id: number): Promise<void> {
  // ON DELETE CASCADE borra también sus filas de reminders.
  await getDb().runAsync('DELETE FROM events WHERE id = ?', id);
}

async function insertReminders(eventId: number, reminders: EventReminder[]): Promise<void> {
  const db = getDb();
  for (const reminder of reminders) {
    await db.runAsync(
      'INSERT INTO reminders (event_id, amount, unit, notification_id) VALUES (?, ?, ?, ?)',
      eventId,
      reminder.amount,
      reminder.unit,
      reminder.notificationId,
    );
  }
}
