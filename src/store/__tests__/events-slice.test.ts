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
  contactId: null,
  phone: null,
  // Un mes antes (para el regalo) + un día antes (para no olvidarse).
  reminders: [
    { amount: 1, unit: 'meses' },
    { amount: 1, unit: 'dias' },
  ],
  yearly: 1,
  isMine: 0,
  tags: [],
  photoUri: null,
};

const avisosProgramados = [
  { amount: 1, unit: 'meses' as const, notificationId: 'notif-1' },
  { amount: 1, unit: 'dias' as const, notificationId: 'notif-2' },
];

const eventoGuardado: EventItem = {
  id: 1,
  title: nuevoEvento.title,
  type: nuevoEvento.type,
  date: nuevoEvento.date,
  time: null,
  description: null,
  contactId: null,
  phone: null,
  yearly: 1,
  isMine: 0,
  reminders: avisosProgramados,
  tags: [],
  photoUri: null,
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
    const nuevosAvisos = [{ amount: 0, unit: 'minutos' as const, notificationId: 'notif-3' }];
    mockSchedule.mockResolvedValue(nuevosAvisos);
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());

    const data: NewEvent = {
      ...nuevoEvento,
      title: 'Cumple de papá',
      reminders: [{ amount: 0, unit: 'minutos' }],
    };
    const actualizado: EventItem = { ...eventoGuardado, title: 'Cumple de papá', reminders: nuevosAvisos };
    mockRepo.updateEvent.mockResolvedValue(actualizado);

    await store.dispatch(editEvent({ id: 1, data, previousReminders: eventoGuardado.reminders }));

    expect(mockCancel).toHaveBeenCalledWith(avisosProgramados);
    expect(mockSchedule).toHaveBeenCalledWith(data);
    expect(mockRepo.updateEvent).toHaveBeenCalledWith(1, data, nuevosAvisos);
    expect(store.getState().events.items[0].title).toBe('Cumple de papá');
  });

  it('conserva los avisos anteriores si no logra programar el reemplazo', async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    mockSchedule.mockRejectedValue(new Error('El sistema de avisos no responde'));
    const store = makeStore();
    await store.dispatch(loadEvents());

    await store.dispatch(
      editEvent({
        id: eventoGuardado.id,
        data: { ...nuevoEvento, title: 'Cumple de papá' },
        previousReminders: eventoGuardado.reminders,
      }),
    );

    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('intenta limpiar los avisos nuevos si falla la cancelación de los anteriores', async () => {
    const nuevosAvisos = [
      { amount: 1, unit: 'horas' as const, notificationId: 'notif-reemplazo-1' },
      { amount: 2, unit: 'dias' as const, notificationId: 'notif-reemplazo-2' },
    ];
    mockSchedule.mockResolvedValue(nuevosAvisos);
    // El primer rechazo representa una cancelación vieja fallida. El segundo
    // representa un fallo parcial durante el cleanup; el thunk debe absorberlo
    // para conservar el error original sin omitir el intento de compensación.
    mockCancel
      .mockRejectedValueOnce(new Error('No se pudo cancelar un aviso anterior'))
      .mockRejectedValueOnce(new Error('No se pudo cancelar un reemplazo'));
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());

    await store.dispatch(
      editEvent({ id: eventoGuardado.id, data: nuevoEvento, previousReminders: eventoGuardado.reminders }),
    );

    expect(mockCancel).toHaveBeenNthCalledWith(1, eventoGuardado.reminders);
    expect(mockCancel).toHaveBeenNthCalledWith(2, nuevosAvisos);
    expect(mockRepo.updateEvent).not.toHaveBeenCalled();
    expect(store.getState().events.items).toEqual([eventoGuardado]);
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
