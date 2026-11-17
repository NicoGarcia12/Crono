import * as recovery from '@/notifications/cancellation-recovery';
import { cancelReminders } from '@/notifications/notifications';
import type { EventReminder } from '@/types';

export { PENDING_CANCELLATIONS_KEY } from '@/notifications/cancellation-recovery';
export type { CancellationResult } from '@/notifications/cancellation-recovery';

// El scheduler también necesita compensar programación parcial. Pasar su
// cancelador al núcleo evita un ciclo de imports entre scheduler y recuperación.
export function cancelRemindersAfterCommit(reminders: EventReminder[], action: string): Promise<recovery.CancellationResult> {
  return recovery.cancelRemindersAfterCommit(cancelReminders, reminders, action);
}

export function retryPendingReminderCancellations(): Promise<recovery.CancellationResult> {
  return recovery.retryPendingReminderCancellations(cancelReminders);
}

export function requireReminderCleanup(): Promise<void> {
  return recovery.requireReminderCleanup(cancelReminders);
}
