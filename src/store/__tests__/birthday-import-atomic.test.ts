import { configureStore } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import reducer, { importBirthdayEvents } from '@/store/events-slice';
import type { EventItem, EventReminder, NewEvent } from '@/types';

// BD y scheduler nativo son límites externos; se mockean para probar sólo la
// orquestación del thunk que corre en el hilo de JavaScript.
jest.mock('@/db/events-repo');
jest.mock('@/notifications/notifications');

const mockRepo = jest.mocked(eventsRepo);
const mockSchedule = jest.mocked(scheduleEventReminders);
const mockCancel = jest.mocked(cancelReminders);

const birthdays: NewEvent[] = [
  {
    title: 'Ana',
    type: 'cumpleanos',
    date: '2026-12-20',
    time: null,
    description: null,
    reminders: [{ amount: 1, unit: 'dias' }],
    yearly: 1,
  },
  {
    title: 'Bruno',
    type: 'cumpleanos',
    date: '2026-03-05',
    time: null,
    description: null,
    reminders: [{ amount: 1, unit: 'dias' }],
    yearly: 1,
  },
];

const anaReminders: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'notif-ana' }];
const brunoReminders: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'notif-bruno' }];

const makeStore = () => configureStore({ reducer: { events: reducer } });

describe('importBirthdayEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compensa todos los avisos programados si falla una escritura del lote', async () => {
    mockSchedule.mockResolvedValueOnce(anaReminders).mockResolvedValueOnce(brunoReminders);
    const persistedAna: EventItem = { ...birthdays[0], id: 1, reminders: anaReminders };
    mockRepo.insertEvent.mockResolvedValueOnce(persistedAna);
    mockRepo.insertEvent.mockRejectedValueOnce(new Error('SQLite sin espacio'));
    const store = makeStore();

    await store.dispatch(importBirthdayEvents(birthdays));

    expect(mockRepo.deleteEvent).toHaveBeenCalledWith(1);
    expect(mockCancel).toHaveBeenCalledWith([...anaReminders, ...brunoReminders]);
    expect(store.getState().events.items).toEqual([]);
  });

  it('no vuelve a importar cumpleaños ya presentes después de un lote exitoso', async () => {
    mockSchedule.mockResolvedValue(anaReminders);
    mockRepo.insertEvent
      .mockResolvedValueOnce({ ...birthdays[0], id: 1, reminders: anaReminders })
      .mockResolvedValueOnce({ ...birthdays[1], id: 2, reminders: anaReminders });
    const store = makeStore();

    await store.dispatch(importBirthdayEvents(birthdays));
    await store.dispatch(importBirthdayEvents(birthdays));

    expect(store.getState().events.items).toHaveLength(2);
    expect(mockRepo.insertEvent).toHaveBeenCalledTimes(2);
  });
});
