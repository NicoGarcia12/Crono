import { configureStore } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminder, scheduleEventReminder } from '@/notifications/notifications';
import reducer, { addEvent, editEvent, loadEvents, removeEvent } from '@/store/events-slice';
import type { EventItem, NewEvent } from '@/types';

/**
 * 💡 Aprendizaje: los thunks se testean con un store REAL (configureStore) y
 * mocks en los límites del sistema: la BD y las notificaciones. Así el test
 * verifica la orquestación completa (persistir → actualizar estado) sin
 * depender de SQLite ni del sistema operativo.
 */

jest.mock('@/db/events-repo');
jest.mock('@/notifications/notifications');

const mockRepo = jest.mocked(eventsRepo);
const mockSchedule = jest.mocked(scheduleEventReminder);
const mockCancel = jest.mocked(cancelReminder);

const makeStore = () => configureStore({ reducer: { events: reducer } });

const nuevoEvento: NewEvent = {
  title: 'Cumple de mamá',
  type: 'cumpleanos',
  date: '2026-08-01',
  time: null,
  description: null,
  reminderMinutes: 60 * 24,
  yearly: 1,
};

const eventoGuardado: EventItem = { ...nuevoEvento, id: 1, notificationId: 'notif-1' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadEvents', () => {
  it('carga los eventos desde la BD y marca el estado como ready', async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();

    await store.dispatch(loadEvents());

    expect(store.getState().events.items).toEqual([eventoGuardado]);
    expect(store.getState().events.status).toBe('ready');
  });

  it('marca el estado como error si la BD falla', async () => {
    mockRepo.findAllEvents.mockRejectedValue(new Error('boom'));
    const store = makeStore();

    await store.dispatch(loadEvents());

    expect(store.getState().events.status).toBe('error');
  });
});

describe('addEvent', () => {
  it('programa el recordatorio, persiste con su id y agrega al estado', async () => {
    mockSchedule.mockResolvedValue('notif-1');
    mockRepo.insertEvent.mockResolvedValue(eventoGuardado);
    const store = makeStore();

    await store.dispatch(addEvent(nuevoEvento));

    expect(mockSchedule).toHaveBeenCalledWith(nuevoEvento);
    expect(mockRepo.insertEvent).toHaveBeenCalledWith(nuevoEvento, 'notif-1');
    expect(store.getState().events.items).toEqual([eventoGuardado]);
  });

  it('persiste sin notificación cuando el entorno no las soporta', async () => {
    mockSchedule.mockResolvedValue(null);
    mockRepo.insertEvent.mockResolvedValue({ ...eventoGuardado, notificationId: null });
    const store = makeStore();

    await store.dispatch(addEvent(nuevoEvento));

    expect(mockRepo.insertEvent).toHaveBeenCalledWith(nuevoEvento, null);
  });
});

describe('editEvent', () => {
  it('cancela la notificación vieja, programa una nueva y actualiza el estado', async () => {
    mockSchedule.mockResolvedValue('notif-2');
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());

    const data: NewEvent = { ...nuevoEvento, title: 'Cumple de papá' };
    await store.dispatch(editEvent({ id: 1, data, previousNotificationId: 'notif-1' }));

    expect(mockCancel).toHaveBeenCalledWith('notif-1');
    expect(mockSchedule).toHaveBeenCalledWith(data);
    expect(mockRepo.updateEvent).toHaveBeenCalledWith({ ...data, id: 1, notificationId: 'notif-2' });
    expect(store.getState().events.items[0].title).toBe('Cumple de papá');
  });
});

describe('removeEvent', () => {
  it('cancela la notificación, borra de la BD y saca del estado', async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());

    await store.dispatch(removeEvent(eventoGuardado));

    expect(mockCancel).toHaveBeenCalledWith('notif-1');
    expect(mockRepo.deleteEvent).toHaveBeenCalledWith(1);
    expect(store.getState().events.items).toEqual([]);
  });
});
