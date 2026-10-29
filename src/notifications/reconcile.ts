import * as remindersRepo from '@/db/reminders-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { cancelRemindersAfterCommit, retryPendingReminderCancellations } from '@/notifications/cancel-after-commit';
import {
  REMINDER_CONTRACT_VERSION,
  remindersAvailable,
  scheduleEventReminders,
} from '@/notifications/notifications';

/**
 * Reconciliación de avisos al arrancar la app.
 *
 * 💡 Aprendizaje: los avisos viven en DOS lugares que no comparten transacción:
 * el SO (que los dispara) y SQLite (donde guardamos sus ids). Cuando cambia lo
 * que le mandamos al SO, los avisos que ya estaban programados quedan con el
 * formato viejo y nadie los reprograma solos. La solución es versionar el
 * contrato (REMINDER_CONTRACT_VERSION), guardar qué versión dejó programado el
 * dispositivo y, si no coincide, reprogramar al arrancar.
 *
 * Por qué así y no otra cosa:
 *  - La marca va en `settings` (clave-valor que ya existe), sin migración de
 *    esquema: es estado de ESTE dispositivo, no del evento.
 *  - La BD es la fuente de verdad: se reprograma cada evento ANUAL con avisos
 *    (el contrato que cambió es el del trigger YEARLY; los avisos puntuales DATE
 *    no se tocan) desde sus filas, nunca desde Redux, y se cancelan los ids que la
 *    BD conoce. No barre otros avisos del SO (no repite la compensación de
 *    huérfanos históricos).
 *  - Límite residual: si el proceso muere (kill) entre programar los avisos
 *    nuevos y confirmar SQLite, los ids nuevos quedan en el SO sin referencia en
 *    la BD y el reintento del arranque siguiente programa otro juego: duplicado
 *    hasta que se barran. No hay compensación posible porque no hay código
 *    corriendo; resolverlo exigiría registrar los ids antes de programar o
 *    barrer el SO, fuera de este alcance.
 *  - Cada evento guarda su progreso junto con los nuevos IDs. El reintento
 *    limpia pendientes antes de programar y omite los eventos ya migrados.
 *  - Una sola ejecución a la vez (React StrictMode monta el layout dos veces).
 *
 * Decisión sobre el 29/2 (límite residual de #38): NO se reprograma cada año.
 *  - El trigger YEARLY nativo guarda un solo (mes, día): no alterna 28/2 ↔ 29/2
 *    aunque lo reprogramemos; elegiría uno de los dos según el año en que corra.
 *  - La reconciliación solo corre si la persona abre la app; el trigger YEARLY
 *    en cambio dispara aunque no se abra, que es lo que lo hace confiable.
 *  - Leyendo expo-notifications 57.0.21 (android/.../NotificationTriggers.kt),
 *    YearlyTrigger.nextTriggerDate() arma un Calendar del año en curso con
 *    DATE=29 y MONTH=1: en un año no bisiesto ese Calendar (lenient) se resuelve
 *    al 1/3, no al 29/2. Reprogramar cada año el día 29 podría empeorar el
 *    aviso en vez de mejorarlo. Es lectura del código fuente, NO validado en un
 *    dispositivo: hay que probarlo en la candidata Android antes de decidir si
 *    conviene fijar siempre el día 28 para los 29/2.
 */

/** Clave en `settings` con la versión del contrato con la que se programaron los avisos de este dispositivo. */
export const REMINDER_CONTRACT_KEY = 'reminderContract';

export type ReconcileReport =
  /** Web / Expo Go Android: no hay scheduler nativo; no se marca nada. */
  | { status: 'unavailable' }
  /** La marca ya coincide con el contrato vigente: no se toca nada. */
  | { status: 'current' }
  | {
      /** `incomplete` requiere recuperación visible sin cerrar la app. */
      status: 'migrated' | 'incomplete';
      /** Eventos reprogramados y persistidos en esta corrida. */
      migrated: number;
      /** Eventos que no se pudieron reprogramar, con su causa. */
      failed: { eventId: number; error: unknown }[];
      cleanupPending?: boolean;
    };

let inFlight: Promise<ReconcileReport> | null = null;

/** Reprograma los avisos del dispositivo si quedaron bajo un contrato anterior. */
export function reconcileReminders(): Promise<ReconcileReport> {
  inFlight ??= runReconciliation().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runReconciliation(): Promise<ReconcileReport> {
  if (!remindersAvailable) return { status: 'unavailable' };

  const cleanup = await retryPendingReminderCancellations();
  if (cleanup.pendingIds.length > 0 || cleanup.error || cleanup.storageError) {
    return { status: 'incomplete', migrated: 0, failed: [], cleanupPending: true };
  }
  // Sin clave = BD creada antes de versionar el contrato (contrato 1).
  const stored = await getSetting(REMINDER_CONTRACT_KEY);
  if (stored === String(REMINDER_CONTRACT_VERSION)) return { status: 'current' };

  const events = await remindersRepo.findEventsWithReminders(REMINDER_CONTRACT_VERSION);
  let migrated = 0;
  const failed: { eventId: number; error: unknown }[] = [];

  // Secuencial: persistir precede siempre a cancelar los avisos anteriores.
  for (const event of events) {
    try {
      await reprogramEvent(event);
      migrated += 1;
    } catch (error: unknown) {
      failed.push({ eventId: event.id, error });
    }
  }

  if (failed.length > 0) return { status: 'incomplete', migrated, failed };

  await setSetting(REMINDER_CONTRACT_KEY, String(REMINDER_CONTRACT_VERSION));
  return { status: 'migrated', migrated, failed };
}

/**
 * El reemplazo y la marca por evento se guardan antes de cancelar lo anterior.
 * Si SQLite rechaza, los anteriores siguen activos y sólo se compensan los nuevos.
 * Si el SO rechaza la limpieza, el helper retiene sus IDs y ofrece reintentar.
 */
async function reprogramEvent(event: remindersRepo.EventWithStoredReminders): Promise<void> {
  const fresh = await scheduleEventReminders(event);
  try {
    await remindersRepo.replaceNotificationIds(event.id, event.reminders, fresh, REMINDER_CONTRACT_VERSION);
  } catch (error: unknown) {
    await cancelRemindersAfterCommit(fresh, 'Reconciliar avisos fallido');
    throw error;
  }
  const cleanup = await cancelRemindersAfterCommit(event.reminders, 'Actualizar avisos');
  if (cleanup.pendingIds.length > 0 || cleanup.error || cleanup.storageError) {
    throw cleanup.error ?? cleanup.storageError ?? new Error('Limpieza de avisos pendiente.');
  }
}
