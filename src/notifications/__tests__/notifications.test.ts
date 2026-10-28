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
  contactId: null,
  phone: null,
  yearly: 0,
  isMine: 0,
  reminders: [
    { amount: 1, unit: 'meses' },
    { amount: 1, unit: 'dias' },
  ],
  tags: [],
  photoUri: null,
  yearUnknown: 0,
};

describe('scheduleEventReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: new Date(2027, 0, 1) });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('compensa los avisos ya programados si falla uno posterior', async () => {
    mockScheduleNotificationAsync
      .mockResolvedValueOnce('notif-mes')
      .mockRejectedValueOnce(new Error('No se pudo programar el segundo aviso'));

    await expect(scheduleEventReminders(evento)).rejects.toThrow('No se pudo programar el segundo aviso');

    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-mes');
  });

  it.each([
    { from: new Date(2027, 1, 27), time: '10:00', day: 28, previousDay: 27, hour: 10 },
    { from: new Date(2027, 1, 28, 9, 59), time: '10:00', day: 28, previousDay: 27, hour: 10 },
    { from: new Date(2027, 1, 28, 10), time: '10:00', day: 28, previousDay: 27, hour: 10 },
    { from: new Date(2027, 1, 28, 10, 1), time: '10:00', day: 29, previousDay: 28, hour: 10 },
    { from: new Date(2027, 11, 31), time: '10:00', day: 29, previousDay: 28, hour: 10 },
    { from: new Date(2028, 0, 1), time: '10:00', day: 29, previousDay: 28, hour: 10 },
    { from: new Date(2028, 1, 28, 12), time: '10:00', day: 29, previousDay: 28, hour: 10 },
    { from: new Date(2028, 1, 29, 10, 1), time: '10:00', day: 28, previousDay: 27, hour: 10 },
    { from: new Date(2028, 2, 1), time: '10:00', day: 28, previousDay: 27, hour: 10 },
    { from: new Date(2027, 1, 28, 23, 59), time: null, day: 28, previousDay: 27, hour: 9 },
    { from: new Date(2028, 1, 29, 23, 59), time: null, day: 29, previousDay: 28, hour: 9 },
  ])('calcula los avisos del 29/2 desde $from con hora $time', async ({ from, time, day, previousDay, hour }) => {
    // Jest corre en JS sin SO nativo: se mockea solo Expo, no el cálculo real de fechas.
    jest.setSystemTime(from);
    mockScheduleNotificationAsync.mockResolvedValue('notif-bisiesto');
    const original = Object.freeze<NewEvent>({
      ...evento,
      date: '2000-02-29',
      yearly: 1,
      time,
      reminders: [
        { amount: 0, unit: 'minutos' },
        { amount: 1, unit: 'dias' },
      ],
    });

    await scheduleEventReminders(original);

    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(1, expect.objectContaining({
      trigger: expect.objectContaining({ type: 'yearly', day, hour, minute: 0 }),
    }));
    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({
      trigger: expect.objectContaining({ type: 'yearly', day: previousDay, hour, minute: 0 }),
    }));
    expect(original.date).toBe('2000-02-29');
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
