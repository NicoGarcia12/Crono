import { configureStore } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminder, scheduleEventReminder } from '@/notifications/notifications';
import reducer, * as eventsSlice from '@/store/events-slice';
import type { NewEvent } from '@/types';

jest.mock('@/db/events-repo');
jest.mock('@/notifications/notifications');

const mockRepo = jest.mocked(eventsRepo);
const mockSchedule = jest.mocked(scheduleEventReminder);
const mockCancel = jest.mocked(cancelReminder);

type ImportBirthdayEvents = (events: NewEvent[]) => ReturnType<typeof eventsSlice.addEvent>;
const importBirthdayEvents = (
  eventsSlice as typeof eventsSlice & { importBirthdayEvents: ImportBirthdayEvents }
).importBirthdayEvents;

const birthdays: NewEvent[] = [
  {
    title: 'Ana',
    type: 'cumpleanos',
    date: '2026-12-20',
    time: null,
    description: null,
    reminderMinutes: 60 * 24,
    yearly: 1,
  },
  {
    title: 'Bruno',
    type: 'cumpleanos',
    date: '2026-03-05',
    time: null,
    description: null,
    reminderMinutes: 60 * 24,
    yearly: 1,
  },
];

describe('importBirthdayEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cancela las notificaciones ya programadas si falla el lote', async () => {
    mockSchedule.mockResolvedValueOnce('notif-ana').mockResolvedValueOnce('notif-bruno');
    mockRepo.insertEvent.mockResolvedValueOnce({ ...birthdays[0], id: 1, notificationId: 'notif-ana' });
    mockRepo.insertEvent.mockRejectedValueOnce(new Error('SQLite sin espacio'));
    const store = configureStore({ reducer: { events: reducer } });

    await store.dispatch(importBirthdayEvents(birthdays));

    expect(mockCancel).toHaveBeenCalledWith('notif-ana');
  });

  it('no publica eventos en Redux cuando falla una escritura del lote', async () => {
    mockSchedule.mockResolvedValueOnce('notif-ana').mockResolvedValueOnce('notif-bruno');
    mockRepo.insertEvent.mockResolvedValueOnce({ ...birthdays[0], id: 1, notificationId: 'notif-ana' });
    mockRepo.insertEvent.mockRejectedValueOnce(new Error('SQLite sin espacio'));
    const store = configureStore({ reducer: { events: reducer } });

    await store.dispatch(importBirthdayEvents(birthdays));

    expect(store.getState().events.items).toEqual([]);
  });

  it('deja el reintento idempotente después de un fallo del lote', async () => {
    mockSchedule.mockResolvedValue('notif');
    mockRepo.insertEvent.mockResolvedValue({ ...birthdays[0], id: 1, notificationId: 'notif' });
    const store = configureStore({ reducer: { events: reducer } });

    await store.dispatch(importBirthdayEvents(birthdays));
    await store.dispatch(importBirthdayEvents(birthdays));

    expect(store.getState().events.items).toHaveLength(2);
  });
});
