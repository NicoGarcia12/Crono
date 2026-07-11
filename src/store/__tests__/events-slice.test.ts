import { configureStore } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
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
const mockSchedule = jest.mocked(scheduleEventReminders);
const mockCancel = jest.mocked(cancelReminders);

const makeStore = () => configureStore({ reducer: { events: reducer } });

const nuevoEvento: NewEvent = {
  title: 'Cumple de mamá',
  type: 'cumpleanos',
  date: '2026-08-01',
  time: null,
  description: null,
  reminderMinutes: [60 * 24, 60 * 24 * 7], // 1 día antes + 1 semana antes
  yearly: 1,
};

const avisosProgramados = [
  { minutes: 60 * 24, notificationId: 'notif-1' },
  { minutes: 60 * 24 * 7, notificationId: 'notif-2' },
];

const eventoGuardado: EventItem = {
  id: 1,
  title: nuevoEvento.title,
  type: nuevoEvento.type,
  date: nuevoEvento.date,
  time: null,
  description: null,
  yearly: 1,
  reminders: avisosProgramados,
};

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
  it('programa TODOS los avisos, persiste con sus ids y agrega al estado', async () => {
    mockSchedule.mockResolvedValue(avisosProgramados);
    mockRepo.insertEvent.mockResolvedValue(eventoGuardado);
    const store = makeStore();

    await store.dispatch(addEvent(nuevoEvento));

    expect(mockSchedule).toHaveBeenCalledWith(nuevoEvento);
    expect(mockRepo.insertEvent).toHaveBeenCalledWith(nuevoEvento, avisosProgramados);
    expect(store.getState().events.items).toEqual([eventoGuardado]);
  });

  it('persiste los avisos sin id cuando el entorno no soporta notificaciones', async () => {
    const sinIds = avisosProgramados.map((r) => ({ ...r, notificationId: null }));
    mockSchedule.mockResolvedValue(sinIds);
    mockRepo.insertEvent.mockResolvedValue({ ...eventoGuardado, reminders: sinIds });
    const store = makeStore();

    await store.dispatch(addEvent(nuevoEvento));

    expect(mockRepo.insertEvent).toHaveBeenCalledWith(nuevoEvento, sinIds);
  });
});

describe('editEvent', () => {
  it('cancela los avisos viejos, programa los nuevos y actualiza el estado', async () => {
    const nuevosAvisos = [{ minutes: 0, notificationId: 'notif-3' }];
    mockSchedule.mockResolvedValue(nuevosAvisos);
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());

    const data: NewEvent = { ...nuevoEvento, title: 'Cumple de papá', reminderMinutes: [0] };
    await store.dispatch(editEvent({ id: 1, data, previousReminders: eventoGuardado.reminders }));

    expect(mockCancel).toHaveBeenCalledWith(avisosProgramados);
    expect(mockSchedule).toHaveBeenCalledWith(data);
    expect(mockRepo.updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, title: 'Cumple de papá', reminders: nuevosAvisos }),
    );
    expect(store.getState().events.items[0].title).toBe('Cumple de papá');
  });
});

describe('removeEvent', () => {
  it('cancela los avisos, borra de la BD y saca del estado', async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());

    await store.dispatch(removeEvent(eventoGuardado));

    expect(mockCancel).toHaveBeenCalledWith(avisosProgramados);
    expect(mockRepo.deleteEvent).toHaveBeenCalledWith(1);
    expect(store.getState().events.items).toEqual([]);
  });
});
