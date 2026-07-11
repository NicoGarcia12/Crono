import { getDb } from '@/db/database';
import type { EventItem, NewEvent } from '@/types';

/**
 * Repositorio de eventos: la ÚNICA capa que habla SQL sobre la tabla `events`.
 *
 * 💡 Aprendizaje: este patrón "repository" es el mismo que usarías con un
 * backend (Prisma/Sequelize). Las pantallas nunca escriben SQL; pasan por acá
 * a través de los thunks de Redux.
 *
 * SQLite usa snake_case en columnas y TypeScript usa camelCase, por eso
 * los SELECT renombran con `AS`.
 */

const SELECT_FIELDS = `
  id, title, type, date, time, description,
  reminder_minutes AS reminderMinutes,
  yearly,
  notification_id AS notificationId
`;

export async function findAllEvents(): Promise<EventItem[]> {
  // Los parámetros SIEMPRE con '?' (binding) — nunca concatenar strings (SQL injection).
  return getDb().getAllAsync<EventItem>(`SELECT ${SELECT_FIELDS} FROM events ORDER BY date ASC`);
}

export async function insertEvent(data: NewEvent, notificationId: string | null): Promise<EventItem> {
  const result = await getDb().runAsync(
    `INSERT INTO events (title, type, date, time, description, reminder_minutes, yearly, notification_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title,
    data.type,
    data.date,
    data.time,
    data.description,
    data.reminderMinutes,
    data.yearly,
    notificationId,
  );
  return { ...data, id: result.lastInsertRowId, notificationId };
}

export async function updateEvent(event: EventItem): Promise<void> {
  await getDb().runAsync(
    `UPDATE events
     SET title = ?, type = ?, date = ?, time = ?, description = ?,
         reminder_minutes = ?, yearly = ?, notification_id = ?
     WHERE id = ?`,
    event.title,
    event.type,
    event.date,
    event.time,
    event.description,
    event.reminderMinutes,
    event.yearly,
    event.notificationId,
    event.id,
  );
}

export async function deleteEvent(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM events WHERE id = ?', id);
}
