import * as remindersRepo from '@/db/reminders-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import { reconcileReminders, REMINDER_CONTRACT_KEY } from '@/notifications/reconcile';

/**
 * 💡 Aprendizaje: acá se mockean los LÍMITES (BD y notificaciones) para probar la
 * orquestación y el orden de pasos. La prueba con SQLite real y el validador de
 * triggers de Expo 57 está en scripts/test-reminders.cjs.
 */

jest.mock('@/db/reminders-repo');
jest.mock('@/db/settings-repo');
jest.mock('@/notifications/notifications', () => ({
  REMINDER_CONTRACT_VERSION: 2,
  remindersAvailable: true,
  scheduleEventReminders: jest.fn(),
  cancelReminders: jest.fn(),
}));

const mockRepo = jest.mocked(remindersRepo);
const mockGetSetting = jest.mocked(getSetting);
const mockSetSetting = jest.mocked(setSetting);
const mockSchedule = jest.mocked(scheduleEventReminders);
const mockCancel = jest.mocked(cancelReminders);

const evento: remindersRepo.EventWithStoredReminders = {
  id: 7,
  title: 'Cumple de mamá',
  type: 'cumpleanos',
  date: '2000-10-15',
  time: '10:00',
  description: null,
  yearly: 1,
  reminders: [
    { rowId: 70, amount: 0, unit: 'minutos', notificationId: 'viejo-1' },
    { rowId: 71, amount: 1, unit: 'dias', notificationId: 'viejo-2' },
  ],
};
const nuevos = [
  { amount: 0, unit: 'minutos' as const, notificationId: 'nuevo-1' },
  { amount: 1, unit: 'dias' as const, notificationId: 'nuevo-2' },
];

beforeEach(() => {
  jest.resetAllMocks();
  mockGetSetting.mockResolvedValue(null);
  mockSetSetting.mockResolvedValue(undefined);
  mockRepo.findEventsWithReminders.mockResolvedValue([evento]);
  mockRepo.replaceNotificationIds.mockResolvedValue(undefined);
});

describe('reconcileReminders', () => {
  it('con el contrato vigente no toca nada', async () => {
    mockGetSetting.mockResolvedValue('2');

    await expect(reconcileReminders()).resolves.toEqual({ status: 'current' });

    expect(mockRepo.findEventsWithReminders).not.toHaveBeenCalled();
    expect(mockSchedule).not.toHaveBeenCalled();
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  it('reprograma, cancela los ids viejos, persiste los nuevos y recién entonces marca el contrato', async () => {
    const operaciones: string[] = [];
    mockSchedule.mockImplementation(async () => {
      operaciones.push('programar');
      return nuevos;
    });
    mockCancel.mockImplementation(async (avisos) => {
      operaciones.push(`cancelar ${avisos.map((a) => a.notificationId).join(',')}`);
    });
    mockRepo.replaceNotificationIds.mockImplementation(async () => {
      operaciones.push('persistir');
    });
    mockSetSetting.mockImplementation(async () => {
      operaciones.push('marcar');
    });

    const report = await reconcileReminders();

    expect(report).toEqual({ status: 'migrated', migrated: 1, failed: [] });
    expect(operaciones).toEqual(['programar', 'cancelar viejo-1,viejo-2', 'persistir', 'marcar']);
    expect(mockRepo.replaceNotificationIds).toHaveBeenCalledWith(7, evento.reminders, nuevos);
    expect(mockSetSetting).toHaveBeenCalledWith(REMINDER_CONTRACT_KEY, '2');
  });

  it('si no logra programar, no cancela nada, no marca el contrato y lo informa', async () => {
    const error = new Error('El sistema de avisos no responde');
    mockSchedule.mockRejectedValue(error);

    const report = await reconcileReminders();

    expect(report).toEqual({ status: 'incomplete', migrated: 0, failed: [{ eventId: 7, error }] });
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  it('si no logra cancelar los viejos, deshace los nuevos y no marca el contrato', async () => {
    mockSchedule.mockResolvedValue(nuevos);
    mockCancel.mockRejectedValueOnce(new Error('El SO no pudo cancelar')).mockResolvedValueOnce(undefined);

    const report = await reconcileReminders();

    expect(report.status).toBe('incomplete');
    expect(mockCancel).toHaveBeenNthCalledWith(1, evento.reminders);
    expect(mockCancel).toHaveBeenNthCalledWith(2, nuevos);
    expect(mockRepo.replaceNotificationIds).not.toHaveBeenCalled();
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  it('si falla persistir, deshace los nuevos aunque la compensación también falle, y conserva el error', async () => {
    const error = new Error('SQLite sin espacio');
    mockSchedule.mockResolvedValue(nuevos);
    mockCancel.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('El SO no responde'));
    mockRepo.replaceNotificationIds.mockRejectedValue(error);

    const report = await reconcileReminders();

    expect(report).toEqual({ status: 'incomplete', migrated: 0, failed: [{ eventId: 7, error }] });
    expect(mockCancel).toHaveBeenNthCalledWith(2, nuevos);
    expect(mockSetSetting).not.toHaveBeenCalled();
  });

  it('dos llamadas simultáneas comparten una sola ejecución', async () => {
    mockSchedule.mockResolvedValue(nuevos);

    const [first, second] = await Promise.all([reconcileReminders(), reconcileReminders()]);

    expect(first).toBe(second);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});
