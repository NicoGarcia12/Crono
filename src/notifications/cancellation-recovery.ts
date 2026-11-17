import { confirmAction } from '@/components/confirm';
import { getSetting, setSetting } from '@/db/settings-repo';
import type { EventReminder } from '@/types';

export const PENDING_CANCELLATIONS_KEY = 'pendingReminderCancellations';
export interface CancellationResult {
  pendingIds: string[];
  error?: unknown;
  storageError?: unknown;
}
type CancelReminders = (reminders: EventReminder[]) => Promise<void>;

let pendingIds: string[] = [];
let tail: Promise<unknown> = Promise.resolve();
let retryInFlight: Promise<CancellationResult> | null = null;
let dialogInFlight: Promise<void> | null = null;

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = tail.then(operation);
  tail = result.catch(() => undefined);
  return result;
}

async function readPending(): Promise<void> {
  const raw = await getSetting(PENDING_CANCELLATIONS_KEY);
  if (!raw) return;
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every((id: unknown): id is string => typeof id === 'string')) {
    throw new Error('No se pudo leer la limpieza pendiente de avisos.');
  }
  pendingIds = [...new Set([...pendingIds, ...value])];
}

async function savePending(): Promise<void> {
  await setSetting(PENDING_CANCELLATIONS_KEY, JSON.stringify(pendingIds));
}

/** SQLite y el SO no comparten rollback. Retenemos los IDs que el SO rechazó,
 * incluso en memoria si SQLite también falla, sin reemplazar la causa original.
 * Se llama FUERA de la transacción del evento para no anidar la cola de SQLite.
 */
export async function cancelRemindersAfterCommit(
  cancelReminders: CancelReminders,
  reminders: EventReminder[],
  action: string,
): Promise<CancellationResult> {
  if (!reminders.some(({ notificationId }) => notificationId !== null)) return { pendingIds: [...pendingIds] };
  try {
    await cancelReminders(reminders);
    return { pendingIds: [...pendingIds] };
  } catch (error: unknown) {
    const ids = reminders.flatMap(({ notificationId }) => notificationId ? [notificationId] : []);
    const result = await serialize(async () => {
      let storageError: unknown;
      let loaded = true;
      try { await readPending(); } catch (cause) { storageError = cause; loaded = false; }
      pendingIds = [...new Set([...pendingIds, ...ids])];
      // Si falló leer, no pisamos IDs persistidos que todavía no conocemos.
      if (loaded) {
        try { await savePending(); } catch (cause) { storageError = cause; }
      }
      return { pendingIds: [...pendingIds], error, ...(storageError ? { storageError } : {}) };
    });
    offerReminderCleanupRetry(cancelReminders, action, result);
    return result;
  }
}

/** Reintentar limpia solamente IDs conocidos: nunca programa otro juego de avisos. */
export function retryPendingReminderCancellations(cancelReminders: CancelReminders): Promise<CancellationResult> {
  retryInFlight ??= serialize(async () => {
    try {
      try {
        await readPending();
      } catch (storageError: unknown) {
        return { pendingIds: [...pendingIds], storageError };
      }
      if (pendingIds.length === 0) return { pendingIds: [] };
      // Puede haber IDs sólo en memoria porque SQLite falló en el intento
      // anterior. Confirmar la unión ANTES de cancelar mantiene su referencia
      // durable aunque el SO vuelva a rechazar la limpieza.
      try {
        await savePending();
      } catch (storageError: unknown) {
        return { pendingIds: [...pendingIds], storageError };
      }
      await cancelReminders(pendingIds.map((notificationId) => ({ amount: 0, unit: 'minutos', notificationId })));
      // Primero confirmar el vaciado: si falla se conservan los IDs para reintentar.
      try {
        await setSetting(PENDING_CANCELLATIONS_KEY, '[]');
      } catch (storageError: unknown) {
        return { pendingIds: [...pendingIds], storageError };
      }
      pendingIds = [];
      return { pendingIds: [] };
    } catch (error: unknown) {
      return { pendingIds: [...pendingIds], error };
    }
  }).finally(() => { retryInFlight = null; });
  return retryInFlight;
}

/** Impide que repetir una operación fallida sume otro juego mientras queda limpieza. */
export async function requireReminderCleanup(cancelReminders: CancelReminders): Promise<void> {
  const result = await retryPendingReminderCancellations(cancelReminders);
  if (result.pendingIds.length > 0 || result.error || result.storageError) {
    offerReminderCleanupRetry(cancelReminders, 'Antes de programar nuevos avisos', result);
    throw new Error('Quedó limpieza de avisos pendiente. Usá Reintentar limpieza antes de volver a guardar.');
  }
}

export function offerReminderCleanupRetry(cancelReminders: CancelReminders, action: string, result: CancellationResult): void {
  if (dialogInFlight || (!result.error && !result.storageError && result.pendingIds.length === 0)) return;
  dialogInFlight = (async () => {
    let current = result;
    do {
      const detail = current.storageError
        ? 'No se pudo guardar la limpieza pendiente. No cierres la app antes de reintentar.'
        : 'Los IDs quedaron registrados para reintentar ahora o al próximo inicio.';
      const retry = await confirmAction('Limpieza de avisos pendiente',
        `${action}: el sistema no pudo completar la cancelación. Pueden seguir apareciendo avisos anteriores o de una operación fallida. ${detail}`,
        'Reintentar limpieza');
      if (!retry) return;
      current = await retryPendingReminderCancellations(cancelReminders);
    } while (current.pendingIds.length > 0 || current.error || current.storageError);
  })().finally(() => { dialogInFlight = null; });
}
