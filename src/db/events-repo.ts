import { getDb } from '@/db/database';
import type * as SQLite from 'expo-sqlite';
import type {
  EventItem,
  EventReminder,
  EventType,
  NewEvent,
  ReminderInput,
  ReminderUnit,
} from '@/types';

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

      const { reminders: _chosen, ...eventWithoutReminders } = event;
      inserted.push({ ...eventWithoutReminders, id: result.lastInsertRowId, reminders });
    }
  });

  return inserted;
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
  await insertRemindersWithExecutor(getDb(), eventId, reminders);
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
      eventId,
      reminder.amount,
      reminder.unit,
      reminder.notificationId,
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
