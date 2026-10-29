import { confirmAction } from '@/components/confirm';
import * as remindersRepo from '@/db/reminders-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { PENDING_CANCELLATIONS_KEY, retryPendingReminderCancellations } from '@/notifications/cancel-after-commit';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import { reconcileReminders, REMINDER_CONTRACT_KEY } from '@/notifications/reconcile';

// Los límites nativos/SQLite se sustituyen; la agenda activa permite comprobar
// lo que le importa a la persona, no solamente el orden de llamadas.
jest.mock('@/db/reminders-repo');
jest.mock('@/db/settings-repo');
jest.mock('@/components/confirm', () => ({ confirmAction: jest.fn() }));
jest.mock('@/notifications/notifications', () => ({
  REMINDER_CONTRACT_VERSION: 2,
  remindersAvailable: true,
  scheduleEventReminders: jest.fn(),
  cancelReminders: jest.fn(),
}));

const mockRepo = jest.mocked(remindersRepo);
const mockGet = jest.mocked(getSetting);
const mockSet = jest.mocked(setSetting);
const mockSchedule = jest.mocked(scheduleEventReminders);
const mockCancel = jest.mocked(cancelReminders);
const evento: remindersRepo.EventWithStoredReminders = {
  id: 7, title: 'Cumple de mamá', type: 'cumpleanos', date: '2000-10-15', time: '10:00', description: null, yearly: 1,
  reminders: [
    { rowId: 70, amount: 0, unit: 'minutos', notificationId: 'viejo-1' },
    { rowId: 71, amount: 1, unit: 'dias', notificationId: 'viejo-2' },
  ],
};
const nuevos = [
  { amount: 0, unit: 'minutos' as const, notificationId: 'nuevo-1' },
  { amount: 1, unit: 'dias' as const, notificationId: 'nuevo-2' },
];
let settings: Map<string, string>;
let active: Set<string>;

beforeEach(async () => {
  jest.resetAllMocks();
  settings = new Map();
  active = new Set(['viejo-1', 'viejo-2']);
  mockGet.mockImplementation(async (key) => settings.get(key) ?? null);
  mockSet.mockImplementation(async (key, value) => { settings.set(key, value); });
  mockCancel.mockResolvedValue(undefined);
  await retryPendingReminderCancellations(); // limpia memoria del caso anterior
  mockCancel.mockClear();
  mockSet.mockClear();
  jest.mocked(confirmAction).mockResolvedValue(false);
  mockRepo.findEventsWithReminders.mockResolvedValue([evento]);
  mockRepo.replaceNotificationIds.mockResolvedValue(undefined);
  mockSchedule.mockImplementation(async () => {
    nuevos.forEach((r) => active.add(r.notificationId));
    return nuevos;
  });
  mockCancel.mockImplementation(async (reminders) => {
    reminders.forEach((r) => { if (r.notificationId) active.delete(r.notificationId); });
  });
});

describe('reconcileReminders', () => {
  it('con el contrato vigente no programa ni cancela', async () => {
    settings.set(REMINDER_CONTRACT_KEY, '2');
    await expect(reconcileReminders()).resolves.toEqual({ status: 'current' });
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('persiste reemplazos antes de cancelar y marca al terminar', async () => {
    mockCancel.mockImplementation(async (reminders) => {
      expect(mockRepo.replaceNotificationIds).toHaveBeenCalledWith(7, evento.reminders, nuevos, 2);
      reminders.forEach((r) => { if (r.notificationId) active.delete(r.notificationId); });
    });
    await expect(reconcileReminders()).resolves.toEqual({ status: 'migrated', migrated: 1, failed: [] });
    expect([...active]).toEqual(['nuevo-1', 'nuevo-2']);
    expect(settings.get(REMINDER_CONTRACT_KEY)).toBe('2');
  });

  it('si SQLite rechaza, conserva anteriores activos y compensa nuevos', async () => {
    const error = new Error('SQLite sin espacio');
    mockRepo.replaceNotificationIds.mockRejectedValue(error);
    await expect(reconcileReminders()).resolves.toEqual({ status: 'incomplete', migrated: 0, failed: [{ eventId: 7, error }] });
    expect([...active]).toEqual(['viejo-1', 'viejo-2']);
    expect(mockCancel).toHaveBeenCalledWith(nuevos);
    expect(settings.has(REMINDER_CONTRACT_KEY)).toBe(false);
  });

  it('cancelación rechazada registra IDs y reintentar sólo limpia, sin programar otra vez lo migrado', async () => {
    mockCancel.mockRejectedValueOnce(new Error('SO ocupado'));
    expect((await reconcileReminders()).status).toBe('incomplete');
    expect(JSON.parse(settings.get(PENDING_CANCELLATIONS_KEY)!)).toEqual(['viejo-1', 'viejo-2']);
    expect(confirmAction).toHaveBeenCalledWith('Limpieza de avisos pendiente', expect.any(String), 'Reintentar limpieza');
    mockRepo.findEventsWithReminders.mockResolvedValue([]); // marca por evento ya confirmada
    await expect(reconcileReminders()).resolves.toEqual({ status: 'migrated', migrated: 0, failed: [] });
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect([...active]).toEqual(['nuevo-1', 'nuevo-2']);
    expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
  });

  it('fallo SQLite y compensación conserva causa, IDs y limpieza recuperable', async () => {
    const error = new Error('SQLite sin espacio');
    mockRepo.replaceNotificationIds.mockRejectedValue(error);
    mockCancel.mockRejectedValueOnce(new Error('SO ocupado'));
    const report = await reconcileReminders();
    expect(report).toMatchObject({ status: 'incomplete', failed: [{ eventId: 7, error }] });
    expect(JSON.parse(settings.get(PENDING_CANCELLATIONS_KEY)!)).toEqual(['nuevo-1', 'nuevo-2']);
    await retryPendingReminderCancellations();
    expect([...active]).toEqual(['viejo-1', 'viejo-2']);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('mientras la limpieza falla no programa y dos llamadas comparten ejecución', async () => {
    settings.set(PENDING_CANCELLATIONS_KEY, '["pendiente"]');
    mockCancel.mockRejectedValue(new Error('SO ocupado'));
    const [first, second] = await Promise.all([reconcileReminders(), reconcileReminders()]);
    expect(first).toBe(second);
    expect(first).toMatchObject({ status: 'incomplete', cleanupPending: true });
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('si programar falla mantiene anteriores y devuelve la causa', async () => {
    const error = new Error('Permiso revocado');
    mockSchedule.mockRejectedValue(error);
    expect(await reconcileReminders()).toMatchObject({ status: 'incomplete', failed: [{ eventId: 7, error }] });
    expect([...active]).toEqual(['viejo-1', 'viejo-2']);
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
