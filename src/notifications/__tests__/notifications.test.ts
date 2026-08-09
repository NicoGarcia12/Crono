import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import type { EventReminder, NewEvent } from '@/types';

const mockScheduleNotificationAsync = jest.fn<Promise<string>, [unknown]>();
const mockCancelScheduledNotificationAsync = jest.fn<Promise<void>, [string]>();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', YEARLY: 'yearly' },
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  setNotificationHandler: jest.fn(),
}));

const evento: NewEvent = {
  title: 'Cumple de mamá',
  type: 'cumpleanos',
  date: '2027-03-31',
  time: '10:00',
  description: null,
  yearly: 0,
  reminders: [
    { amount: 1, unit: 'meses' },
    { amount: 1, unit: 'dias' },
  ],
};

describe('scheduleEventReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(new Date(2027, 0, 1).getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('compensa los avisos ya programados si falla uno posterior', async () => {
    mockScheduleNotificationAsync
      .mockResolvedValueOnce('notif-mes')
      .mockRejectedValueOnce(new Error('No se pudo programar el segundo aviso'));

    await expect(scheduleEventReminders(evento)).rejects.toThrow('No se pudo programar el segundo aviso');

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-mes');
  });
});

describe('cancelReminders', () => {
  it('intenta cancelar todos los avisos aunque una cancelación falle', async () => {
    const reminders: EventReminder[] = [
      { amount: 1, unit: 'dias', notificationId: 'notif-con-error' },
      { amount: 1, unit: 'horas', notificationId: 'notif-limpiado' },
    ];
    mockCancelScheduledNotificationAsync
      .mockRejectedValueOnce(new Error('El SO no pudo cancelar el primer aviso'))
      .mockResolvedValueOnce(undefined);

    await expect(cancelReminders(reminders)).rejects.toThrow('El SO no pudo cancelar el primer aviso');

    // `allSettled` evita que el segundo aviso quede huérfano por el fallo del primero.
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-con-error');
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-limpiado');
  });
});
