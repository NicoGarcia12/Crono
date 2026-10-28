import { configureStore } from '@reduxjs/toolkit';

import { confirmAction } from '@/components/confirm';
import { getSetting, setSetting } from '@/db/settings-repo';
import { PENDING_CANCELLATIONS_KEY, retryPendingReminderCancellations } from '@/notifications/cancel-after-commit';
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
jest.mock('@/db/settings-repo');
jest.mock('@/components/confirm', () => ({ confirmAction: jest.fn() }));

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
  yearUnknown: 0,
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
  yearUnknown: 0,
};

let settings: Map<string, string>;
beforeEach(async () => {
  jest.resetAllMocks();
  settings = new Map();
  jest.mocked(getSetting).mockImplementation(async (key) => settings.get(key) ?? null);
  jest.mocked(setSetting).mockImplementation(async (key, value) => { settings.set(key, value); });
  jest.mocked(confirmAction).mockResolvedValue(false);
  mockCancel.mockResolvedValue(undefined);
  await retryPendingReminderCancellations();
  mockCancel.mockClear();
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
  it('compensa los avisos programados si falla persistir el evento', async () => {
    const operations: string[] = [];
    mockSchedule.mockImplementation(async () => {
      operations.push('programar');
      return avisosProgramados;
    });
    mockRepo.insertEvent.mockImplementation(async () => {
      operations.push('persistir');
      throw new Error('SQLite sin espacio');
    });
    mockCancel.mockImplementation(async () => {
      operations.push('cancelar');
    });
    const store = makeStore();

    await store.dispatch(addEvent(nuevoEvento));

    expect(operations).toEqual(['programar', 'persistir', 'cancelar']);
  });

  it('conserva el error de persistencia si falla la compensación', async () => {
    mockSchedule.mockResolvedValue(avisosProgramados);
    mockRepo.insertEvent.mockRejectedValue(new Error('SQLite sin espacio'));
    mockCancel.mockRejectedValueOnce(new Error('El sistema de avisos no responde'));
    const store = makeStore();

    const result = await store.dispatch(addEvent(nuevoEvento));

    expect(result).toMatchObject({ error: { message: 'SQLite sin espacio' } });
  });

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
  const nuevosAvisos = [{ amount: 0, unit: 'minutos' as const, notificationId: 'notif-3' }];
  const data: NewEvent = {
    ...nuevoEvento,
    title: 'Cumple de papá',
    reminders: [{ amount: 0, unit: 'minutos' }],
  };
  const actualizado: EventItem = { ...eventoGuardado, title: 'Cumple de papá', reminders: nuevosAvisos };

  const storeConEvento = async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    const store = makeStore();
    await store.dispatch(loadEvents());
    return store;
  };

  it('programa los nuevos, persiste y RECIÉN ENTONCES cancela los anteriores', async () => {
    const operaciones: string[] = [];
    mockSchedule.mockImplementation(async () => {
      operaciones.push('programar');
      return nuevosAvisos;
    });
    mockRepo.updateEvent.mockImplementation(async () => {
      operaciones.push('persistir');
      return actualizado;
    });
    mockCancel.mockImplementation(async (avisos) => {
      operaciones.push(`cancelar ${avisos.map((a) => a.notificationId).join(',')}`);
    });
    const store = await storeConEvento();

    await store.dispatch(editEvent({ id: 1, data, previousReminders: eventoGuardado.reminders }));

    expect(operaciones).toEqual(['programar', 'persistir', 'cancelar notif-1,notif-2']);
    expect(mockSchedule).toHaveBeenCalledWith(data);
    expect(mockRepo.updateEvent).toHaveBeenCalledWith(1, data, nuevosAvisos);
    expect(store.getState().events.items[0].title).toBe('Cumple de papá');
  });

  it('conserva los avisos anteriores si no logra programar el reemplazo', async () => {
    mockSchedule.mockRejectedValue(new Error('El sistema de avisos no responde'));
    const store = await storeConEvento();

    await store.dispatch(
      editEvent({ id: eventoGuardado.id, data, previousReminders: eventoGuardado.reminders }),
    );

    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockRepo.updateEvent).not.toHaveBeenCalled();
  });

  it('si falla persistir, los avisos anteriores siguen activos y los reemplazos no quedan huérfanos', async () => {
    mockSchedule.mockResolvedValue(nuevosAvisos);
    mockRepo.updateEvent.mockRejectedValue(new Error('SQLite sin espacio'));
    const store = await storeConEvento();

    const result = await store.dispatch(
      editEvent({ id: eventoGuardado.id, data, previousReminders: eventoGuardado.reminders }),
    );

    expect(result).toMatchObject({ error: { message: 'SQLite sin espacio' } });
    // Sólo se cancelan los reemplazos recién creados; los anteriores NO se tocan.
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith(nuevosAvisos);
    expect(store.getState().events.items).toEqual([eventoGuardado]);
  });

  it('conserva el error de persistencia si además falla la limpieza de los reemplazos', async () => {
    mockSchedule.mockResolvedValue(nuevosAvisos);
    mockRepo.updateEvent.mockRejectedValue(new Error('SQLite sin espacio'));
    mockCancel.mockRejectedValueOnce(new Error('No se pudo cancelar un reemplazo'));
    const store = await storeConEvento();

    const result = await store.dispatch(
      editEvent({ id: eventoGuardado.id, data, previousReminders: eventoGuardado.reminders }),
    );

    expect(result).toMatchObject({ error: { message: 'SQLite sin espacio' } });
    expect(JSON.parse(settings.get(PENDING_CANCELLATIONS_KEY)!)).toEqual(['notif-3']);
    expect(confirmAction).toHaveBeenCalledWith('Limpieza de avisos pendiente', expect.any(String), 'Reintentar limpieza');
    await retryPendingReminderCancellations();
    expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });

  it('si la edición ya se guardó registra limpieza pendiente y la recupera sin reprogramar', async () => {
    mockSchedule.mockResolvedValue(nuevosAvisos);
    mockRepo.updateEvent.mockResolvedValue(actualizado);
    mockCancel.mockRejectedValueOnce(new Error('El SO no pudo cancelar'));
    const store = await storeConEvento();

    const result = await store.dispatch(
      editEvent({ id: eventoGuardado.id, data, previousReminders: eventoGuardado.reminders }),
    );

    expect(result.type).toBe(editEvent.fulfilled.type);
    expect(store.getState().events.items[0].title).toBe('Cumple de papá');
    expect(JSON.parse(settings.get(PENDING_CANCELLATIONS_KEY)!)).toEqual(['notif-1', 'notif-2']);
    await retryPendingReminderCancellations();
    expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
    expect(mockSchedule).toHaveBeenCalledTimes(1);
  });
});

describe('removeEvent', () => {
  it('borra de la BD, cancela los avisos y saca del estado', async () => {
    const operaciones: string[] = [];
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    mockRepo.deleteEvent.mockImplementation(async () => {
      operaciones.push('borrar');
    });
    mockCancel.mockImplementation(async () => {
      operaciones.push('cancelar');
    });
    const store = makeStore();
    await store.dispatch(loadEvents());

    await store.dispatch(removeEvent(eventoGuardado));

    expect(operaciones).toEqual(['borrar', 'cancelar']);
    expect(mockCancel).toHaveBeenCalledWith(avisosProgramados);
    expect(mockRepo.deleteEvent).toHaveBeenCalledWith(1);
    expect(store.getState().events.items).toEqual([]);
  });

  it('si falla el borrado, el evento y sus avisos siguen intactos', async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    mockRepo.deleteEvent.mockRejectedValue(new Error('SQLite bloqueada'));
    const store = makeStore();
    await store.dispatch(loadEvents());

    const result = await store.dispatch(removeEvent(eventoGuardado));

    expect(result).toMatchObject({ error: { message: 'SQLite bloqueada' } });
    expect(mockCancel).not.toHaveBeenCalled();
    expect(store.getState().events.items).toEqual([eventoGuardado]);
  });

  it('si el borrado ya se confirmó, elimina de Redux y ofrece limpiar sin recrear el evento', async () => {
    mockRepo.findAllEvents.mockResolvedValue([eventoGuardado]);
    mockRepo.deleteEvent.mockResolvedValue(undefined);
    mockCancel.mockRejectedValueOnce(new Error('El SO no pudo cancelar'));
    const store = makeStore();
    await store.dispatch(loadEvents());

    const result = await store.dispatch(removeEvent(eventoGuardado));

    expect(result.type).toBe(removeEvent.fulfilled.type);
    expect(store.getState().events.items).toEqual([]);
    expect(JSON.parse(settings.get(PENDING_CANCELLATIONS_KEY)!)).toEqual(['notif-1', 'notif-2']);
    expect(confirmAction).toHaveBeenCalled();
    await retryPendingReminderCancellations();
    expect(settings.get(PENDING_CANCELLATIONS_KEY)).toBe('[]');
    expect(mockSchedule).not.toHaveBeenCalled();
  });
});
