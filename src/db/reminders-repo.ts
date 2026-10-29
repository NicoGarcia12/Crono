import { getDb } from '@/db/database';
import { withEventTransaction } from '@/db/event-transaction';
import type { EventReminder, EventType, ReminderUnit } from '@/types';

/**
 * Lecturas/escrituras de los avisos que NO pasan por el formulario de un
 * evento: las usa la reconciliación de arranque (src/notifications/reconcile.ts)
 * para reprogramar avisos sin tocar título, fecha, etiquetas ni campos.
 *
 * Es un archivo aparte de events-repo para no mezclar el guardado del
 * formulario (agregado completo en una transacción) con el mantenimiento de
 * los ids que el SO le dio a cada aviso.
 */

export interface StoredReminder extends EventReminder {
  /** Id de la fila en `reminders`: permite actualizar sin depender del orden ni de (amount, unit). */
  rowId: number;
}

/** Los campos del evento que el scheduler necesita, más sus filas de avisos. */
export interface EventWithStoredReminders {
  id: number;
  title: string;
  type: EventType;
  date: string;
  time: string | null;
  description: string | null;
  yearly: 0 | 1;
  reminders: StoredReminder[];
}

interface EventRow {
  id: number;
  title: string;
  type: EventType;
  date: string;
  time: string | null;
  description: string | null;
  yearly: 0 | 1;
}

interface ReminderRow {
  rowId: number;
  eventId: number;
  amount: number;
  unit: ReminderUnit;
  notificationId: string | null;
}

/**
 * Eventos ANUALES con al menos un aviso, con el id de fila y de notificación de cada uno.
 * Sólo los anuales: el contrato que cambió es el del trigger YEARLY. Los avisos puntuales
 * (trigger DATE) no se tocan. La marca por evento evita reprogramar los ya migrados.
 */
export async function findEventsWithReminders(contractVersion?: number): Promise<EventWithStoredReminders[]> {
  const db = getDb();
  const events = await db.getAllAsync<EventRow>(
    `SELECT id, title, type, date, time, description, yearly
     FROM events
     WHERE yearly = 1 AND id IN (SELECT event_id FROM reminders)
       AND NOT EXISTS (SELECT 1 FROM settings WHERE key = 'reminderContractEvent:' || events.id AND value = ?)
     ORDER BY id ASC`,
    String(contractVersion ?? ''),
  );
  const reminders = await db.getAllAsync<ReminderRow>(
    `SELECT id AS rowId, event_id AS eventId, amount, unit, notification_id AS notificationId
     FROM reminders ORDER BY id ASC`,
  );

  const byEvent = new Map<number, StoredReminder[]>();
  for (const { eventId, ...reminder } of reminders) {
    const list = byEvent.get(eventId) ?? [];
    list.push(reminder);
    byEvent.set(eventId, list);
  }
  return events.map((event) => ({ ...event, reminders: byEvent.get(event.id) ?? [] }));
}

/**
 * Reemplaza los ids de notificación de un evento por los recién programados.
 *
 * `expected` es la foto que se leyó antes de reprogramar: si las filas cambiaron
 * mientras tanto (el usuario editó o borró el evento, se restauró un backup), no
 * se pisa nada y se lanza, para que el llamador compense lo que programó. Así la
 * reconciliación nunca revierte una edición hecha en el medio.
 *
 * `fresh` debe venir en el mismo orden que `expected`.
 */
export async function replaceNotificationIds(
  eventId: number,
  expected: readonly StoredReminder[],
  fresh: readonly EventReminder[],
  contractVersion?: number,
): Promise<void> {
  if (expected.length !== fresh.length) {
    throw new Error('Cada aviso reprogramado debe corresponder a una fila existente.');
  }
  // Misma cola de escritura que el guardado de eventos: nunca hay dos BEGIN a la vez.
  await withEventTransaction(getDb(), async (transaction) => {
    const current = await transaction.getAllAsync<{
      id: number;
      amount: number;
      unit: ReminderUnit;
      notificationId: string | null;
    }>(
      `SELECT id, amount, unit, notification_id AS notificationId
       FROM reminders WHERE event_id = ? ORDER BY id ASC`,
      eventId,
    );
    const unchanged =
      current.length === expected.length &&
      current.every(
        (row, index) =>
          row.id === expected[index].rowId &&
          row.amount === expected[index].amount &&
          row.unit === expected[index].unit &&
          row.notificationId === expected[index].notificationId,
      );
    if (!unchanged) {
      throw new Error('Los avisos del evento cambiaron durante la reconciliación.');
    }

    for (const [index, reminder] of fresh.entries()) {
      await transaction.runAsync(
        'UPDATE reminders SET notification_id = ? WHERE id = ?',
        reminder.notificationId,
        expected[index].rowId,
      );
    }
    if (contractVersion !== undefined) {
      // La marca y los nuevos IDs se confirman juntos: un reintento de limpieza
      // no vuelve a programar los eventos que ya migraron.
      await transaction.runAsync(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        `reminderContractEvent:${eventId}`, String(contractVersion),
      );
    }
  });
}
