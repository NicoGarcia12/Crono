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
  // Los parámetros SIEMPRE con '?' (binding) — nunca concatenar strings (SQL injection).
  // Solo un evento puede ser "mi cumpleaños": si este lo es, se lo saca al anterior.
  if (data.isMine) await clearMine(null);

  const result = await db.runAsync(
    `INSERT INTO events (title, type, date, time, description, yearly, contact_id, phone, is_mine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title,
    data.type,
    data.date,
    data.time,
    data.description,
    data.yearly,
    data.contactId,
    data.phone,
    data.isMine,
  );
  const eventId = result.lastInsertRowId;
  await insertReminders(eventId, reminders);

  const { reminders: _chosen, ...event } = data;
  return { ...event, id: eventId, reminders };
}

export async function updateEvent(event: EventItem): Promise<void> {
  const db = getDb();

  if (event.isMine) await clearMine(event.id);

  await db.runAsync(
    `UPDATE events
     SET title = ?, type = ?, date = ?, time = ?, description = ?, yearly = ?,
         contact_id = ?, phone = ?, is_mine = ?
     WHERE id = ?`,
    event.title,
    event.type,
    event.date,
    event.time,
    event.description,
    event.yearly,
    event.contactId,
    event.phone,
    event.isMine,
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

/** Le saca la marca de "mi cumpleaños" a cualquier otro evento que la tenga. */
async function clearMine(exceptId: number | null): Promise<void> {
  const db = getDb();
  if (exceptId === null) {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1');
  } else {
    await db.runAsync('UPDATE events SET is_mine = 0 WHERE is_mine = 1 AND id != ?', exceptId);
  }
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
