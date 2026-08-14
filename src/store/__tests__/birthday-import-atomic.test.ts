import { configureStore } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import reducer, { addContactBirthdays } from '@/store/events-slice';
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
    contactId: 'contact-ana',
    phone: null,
    reminders: [{ amount: 1, unit: 'dias' }],
    yearly: 1,
    isMine: 0,
  },
  {
    title: 'Bruno',
    type: 'cumpleanos',
    date: '2026-03-05',
    time: null,
    description: null,
    contactId: 'contact-bruno',
    phone: null,
    reminders: [{ amount: 1, unit: 'dias' }],
    yearly: 1,
    isMine: 0,
  },
];

const anaReminders: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'notif-ana' }];
const brunoReminders: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'notif-bruno' }];

const makeStore = () => configureStore({ reducer: { events: reducer } });

describe('addContactBirthdays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('compensa todos los avisos programados si falla la transacción del lote', async () => {
    mockSchedule.mockResolvedValueOnce(anaReminders).mockResolvedValueOnce(brunoReminders);
    mockRepo.insertContactBirthdays.mockRejectedValueOnce(new Error('SQLite sin espacio'));
    const store = makeStore();

    await store.dispatch(addContactBirthdays(birthdays));

    expect(mockRepo.insertContactBirthdays).toHaveBeenCalledWith(birthdays, [anaReminders, brunoReminders]);
    expect(mockCancel).toHaveBeenCalledWith(anaReminders);
    expect(mockCancel).toHaveBeenCalledWith(brunoReminders);
    expect(store.getState().events.items).toEqual([]);
  });

  it('agrega sólo el resultado confirmado de SQLite, que deduplica por contact_id', async () => {
    mockSchedule.mockResolvedValue(anaReminders);
    const persisted = birthdays.map((birthday, index) => ({ ...birthday, id: index + 1, reminders: anaReminders }));
    mockRepo.insertContactBirthdays.mockResolvedValueOnce(persisted);
    const store = makeStore();

    await store.dispatch(addContactBirthdays(birthdays));

    expect(store.getState().events.items).toHaveLength(2);
    expect(mockRepo.insertContactBirthdays).toHaveBeenCalledTimes(1);
  });
});
