import { Platform } from 'react-native';

import {
  cancelReminders,
  getNotificationPermissionState,
  requestNotificationPermission,
  scheduleEventReminders,
  setupNotificationChannel,
} from '@/notifications/notifications';
import type { EventReminder, NewEvent } from '@/types';

type PermissionResponse = { status: 'granted' | 'denied' | 'undetermined'; canAskAgain?: boolean };

const mockScheduleNotificationAsync = jest.fn<Promise<string>, [unknown]>();
const mockCancelScheduledNotificationAsync = jest.fn<Promise<void>, [string]>();
const mockSetNotificationChannelAsync = jest.fn<Promise<unknown>, [string, unknown]>();
const mockGetPermissionsAsync = jest.fn<Promise<PermissionResponse>, []>();
const mockRequestPermissionsAsync = jest.fn<Promise<PermissionResponse>, []>();

jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', YEARLY: 'yearly' },
  scheduleNotificationAsync: mockScheduleNotificationAsync,
  cancelScheduledNotificationAsync: mockCancelScheduledNotificationAsync,
  setNotificationChannelAsync: mockSetNotificationChannelAsync,
  getPermissionsAsync: mockGetPermissionsAsync,
  requestPermissionsAsync: mockRequestPermissionsAsync,
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
      trigger: expect.objectContaining({ type: 'yearly', month: 1, day, hour, minute: 0 }),
    }));
    expect(mockScheduleNotificationAsync).toHaveBeenNthCalledWith(2, expect.objectContaining({
      trigger: expect.objectContaining({ type: 'yearly', month: 1, day: previousDay, hour, minute: 0 }),
    }));
    expect(original.date).toBe('2000-02-29');
  });

  /**
   * Contrato de Expo 57 (YearlyTriggerInput): `month` usa los rangos de Date,
   * enero = 0. Se compara contra getMonth() de la fecha esperada del aviso.
   */
  it.each([
    { date: '2000-01-31', reminders: [{ amount: 0, unit: 'minutos' as const }], month: 0, day: 31 },
    { date: '2000-12-15', reminders: [{ amount: 0, unit: 'minutos' as const }], month: 11, day: 15 },
    { date: '2000-10-15', reminders: [{ amount: 0, unit: 'minutos' as const }], month: 9, day: 15 },
    { date: '2000-01-05', reminders: [{ amount: 1, unit: 'semanas' as const }], month: 11, day: 29 },
    { date: '2000-03-31', reminders: [{ amount: 1, unit: 'meses' as const }], month: 1, day: 28 },
    { date: '2000-12-31', reminders: [{ amount: 1, unit: 'meses' as const }], month: 10, day: 30 },
  ])('programa $date con month 0-11 (mes $month, día $day)', async ({ date, reminders, month, day }) => {
    jest.setSystemTime(new Date(2027, 0, 1));
    mockScheduleNotificationAsync.mockResolvedValue('notif-anual');

    await scheduleEventReminders({ ...evento, date, time: '10:00', yearly: 1, reminders });

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
      trigger: expect.objectContaining({ type: 'yearly', month, day, hour: 10, minute: 0 }),
    }));
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

/**
 * CRONO44: el canal Android se sigue creando en el arranque (instalaciones
 * existentes no pierden avisos), pero el permiso ya no se pide ahí sino
 * después de la bienvenida. Por eso son dos funciones separadas.
 */
describe('setupNotificationChannel', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetNotificationChannelAsync.mockResolvedValue(null);
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('en Android crea el canal "recordatorios"', async () => {
    Platform.OS = 'android';

    await setupNotificationChannel();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'recordatorios',
      expect.objectContaining({ name: 'Recordatorios' }),
    );
  });

  it('en Android no pide el permiso de notificaciones', async () => {
    Platform.OS = 'android';

    await setupNotificationChannel();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('en iOS no crea canales ni pide permiso', async () => {
    Platform.OS = 'ios';

    await setupNotificationChannel();

    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('requestNotificationPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pide el permiso si todavía no fue concedido', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a pedirlo si ya está concedido', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });
});

/**
 * CRONO44 ronda 2: la fila "Avisos" de Perfil necesita saber si el permiso
 * está concedido, si todavía se puede pedir o si el SO lo bloqueó (solo
 * queda ir a los ajustes del sistema).
 */
describe('getNotificationPermissionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("con el permiso concedido devuelve 'granted'", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted', canAskAgain: true });

    await expect(getNotificationPermissionState()).resolves.toBe('granted');
  });

  it("sin responder todavía devuelve 'askable'", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });

    await expect(getNotificationPermissionState()).resolves.toBe('askable');
  });

  it("denegado pero con canAskAgain devuelve 'askable'", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: true });

    await expect(getNotificationPermissionState()).resolves.toBe('askable');
  });

  it("denegado sin canAskAgain devuelve 'blocked'", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });

    await expect(getNotificationPermissionState()).resolves.toBe('blocked');
  });

  it('consultar el estado nunca dispara el pedido de permiso', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined', canAskAgain: true });

    await getNotificationPermissionState();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
  });
});
