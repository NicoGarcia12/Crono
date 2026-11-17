import { currentDialog, resolveDialog } from '@/components/confirm';
import { getSetting, setSetting } from '@/db/settings-repo';
import {
  cancelRemindersAfterCommit,
  PENDING_CANCELLATIONS_KEY,
  retryPendingReminderCancellations,
} from '@/notifications/cancel-after-commit';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import type { EventReminder } from '@/types';

// El diálogo es REAL: se comprueba la acción que puede tocar la persona.
// Sólo SQLite y el puente nativo necesitan dobles fuera del dispositivo.
jest.mock('@/db/settings-repo');
jest.mock('@/notifications/notifications');
const mockCancel = jest.mocked(cancelReminders);
let settings: Map<string, string>;
const reminders: EventReminder[] = [{ amount: 0, unit: 'minutos', notificationId: 'pendiente' }];

beforeEach(async () => {
  jest.resetAllMocks();
  settings = new Map();
  jest.mocked(getSetting).mockImplementation(async (key) => settings.get(key) ?? null);
  jest.mocked(setSetting).mockImplementation(async (key, value) => { settings.set(key, value); });
  mockCancel.mockResolvedValue(undefined);
  await retryPendingReminderCancellations();
  mockCancel.mockClear();
});

afterEach(async () => {
  const dialog = currentDialog();
  if (dialog) resolveDialog(dialog.id, false);
  await Promise.resolve();
});

it('registra IDs y el botón Reintentar limpieza cancela sin programar otro aviso', async () => {
  const active = new Set(['pendiente']);
  mockCancel.mockRejectedValueOnce(new Error('SO ocupado')).mockImplementation(async (items) => {
    items.forEach((item) => { if (item.notificationId) active.delete(item.notificationId); });
  });
  const result = await cancelRemindersAfterCommit(reminders, 'Editar evento');
  expect(result.pendingIds).toEqual(['pendiente']);
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('["pendiente"]');
  const dialog = currentDialog()!;
  expect(dialog.title).toBe('Limpieza de avisos pendiente');
  expect(dialog.buttons).toContainEqual(expect.objectContaining({ label: 'Reintentar limpieza', value: true }));
  resolveDialog(dialog.id, true);
  await retryPendingReminderCancellations();
  expect([...active]).toEqual([]);
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
  expect(scheduleEventReminders).not.toHaveBeenCalled();
});

it('si SQLite también rechaza el registro, conserva memoria y advierte no cerrar la app', async () => {
  mockCancel.mockRejectedValueOnce(new Error('SO ocupado'));
  jest.mocked(setSetting).mockRejectedValueOnce(new Error('SQLite sin espacio'));
  const result = await cancelRemindersAfterCommit(reminders, 'Editar evento fallido');
  expect(result.pendingIds).toEqual(['pendiente']);
  expect(result.storageError).toBeInstanceOf(Error);
  expect(currentDialog()?.message).toContain('No cierres la app');
  await retryPendingReminderCancellations();
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
  expect(mockCancel).toHaveBeenLastCalledWith(reminders);
  expect(scheduleEventReminders).not.toHaveBeenCalled();
});

it('al arrancar recupera IDs persistidos y dos reintentos comparten el mismo trabajo', async () => {
  settings.set(PENDING_CANCELLATIONS_KEY, '["pendiente"]');
  const first = retryPendingReminderCancellations();
  const second = retryPendingReminderCancellations();
  expect(first).toBe(second);
  await expect(first).resolves.toEqual({ pendingIds: [] });
  expect(mockCancel).toHaveBeenCalledTimes(1);
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
  expect(scheduleEventReminders).not.toHaveBeenCalled();
});

it('si falla leer el registro no pisa IDs previos y los une al recuperar SQLite', async () => {
  settings.set(PENDING_CANCELLATIONS_KEY, '["previo"]');
  jest.mocked(getSetting).mockRejectedValueOnce(new Error('Lectura SQLite fallida'));
  mockCancel.mockRejectedValueOnce(new Error('SO ocupado'));
  const writes = jest.mocked(setSetting).mock.calls.length;
  const result = await cancelRemindersAfterCommit(reminders, 'Editar evento fallido');
  expect(result.storageError).toBeInstanceOf(Error);
  expect(jest.mocked(setSetting)).toHaveBeenCalledTimes(writes);
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('["previo"]');
  await retryPendingReminderCancellations();
  expect(mockCancel).toHaveBeenLastCalledWith([
    { amount: 0, unit: 'minutos', notificationId: 'pendiente' },
    { amount: 0, unit: 'minutos', notificationId: 'previo' },
  ]);
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
});

it.each(['read', 'write'] as const)('recupera SQLite tras fallo de %s y persiste la unión aunque el SO siga rechazando', async (boundary) => {
  const nativeError = new Error('SO ocupado');
  const storageError = new Error('SQLite no disponible');
  settings.set(PENDING_CANCELLATIONS_KEY, '["previo"]');
  if (boundary === 'read') jest.mocked(getSetting).mockRejectedValueOnce(storageError);
  else jest.mocked(setSetting).mockRejectedValueOnce(storageError);
  mockCancel.mockRejectedValue(nativeError);

  const first = await cancelRemindersAfterCommit(reminders, 'Editar evento fallido');
  expect(first.error).toBe(nativeError);
  expect(first.storageError).toBe(storageError);
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('["previo"]');

  const retry = await retryPendingReminderCancellations();
  expect(retry.error).toBe(nativeError);
  expect(retry.storageError).toBeUndefined();
  expect(new Set(JSON.parse(settings.get(PENDING_CANCELLATIONS_KEY)!))).toEqual(new Set(['pendiente', 'previo']));
  expect(scheduleEventReminders).not.toHaveBeenCalled();

  mockCancel.mockResolvedValue(undefined);
  await retryPendingReminderCancellations();
  expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
});
