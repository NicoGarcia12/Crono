import { cancelReminders } from '@/notifications/notifications';
import type { EventReminder } from '@/types';

/**
 * Cancela los avisos de un evento que YA se guardó/borró en SQLite.
 *
 * 💡 Aprendizaje: SQLite hace rollback; el SO no. Por eso el orden importa:
 * primero se confirma la BD y recién después se cancelan los avisos
 * reemplazados. Así, si guardar falla, los avisos anteriores siguen activos
 * (no hay que "restaurarlos") y sólo hay que deshacer los nuevos.
 *
 * Acá la BD ya confirmó, así que un fallo del SO no puede revertir la edición
 * ni el borrado: lanzar dejaría a Redux desactualizado respecto de SQLite. Se
 * deja constancia con `console.warn` (con los ids, para poder rastrearlos) en
 * vez de tragarse el error. `cancelReminders` ya intenta TODOS los ids aunque
 * uno falle, así que sólo pueden quedar los que el SO se negó a cancelar.
 */
export async function cancelRemindersAfterCommit(
  reminders: EventReminder[],
  action: string,
): Promise<void> {
  try {
    await cancelReminders(reminders);
  } catch (error: unknown) {
    const ids = reminders.flatMap(({ notificationId }) => (notificationId ? [notificationId] : []));
    console.warn(`${action}: no se pudieron cancelar los avisos anteriores (${ids.join(', ')})`, error);
  }
}
