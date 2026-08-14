import { configureStore } from '@reduxjs/toolkit';

import { backupFileName, buildBackup, serializeBackup } from '@/backup/backup';
import { pickTextFile, saveAndShare } from '@/backup/file-io';
import * as eventsRepo from '@/db/events-repo';
import * as greetingsRepo from '@/db/greetings-repo';
import * as notesRepo from '@/db/notes-repo';
import { scheduleEventReminders } from '@/notifications/notifications';
import eventsReducer from '@/store/events-slice';
import greetingsReducer from '@/store/greetings-slice';
import notesReducer from '@/store/notes-slice';
import settingsReducer from '@/store/settings-slice';
import { exportBackup, restoreBackup } from '@/store/backup-slice';
import type { EventItem, Greeting, Note } from '@/types';

// Límites del sistema mockeados: archivos, BD y notificaciones.
jest.mock('@/backup/file-io');
jest.mock('@/db/events-repo');
jest.mock('@/db/greetings-repo');
jest.mock('@/db/notes-repo');
jest.mock('@/notifications/notifications');

const mockPick = jest.mocked(pickTextFile);
const mockSave = jest.mocked(saveAndShare);
const mockEventsRepo = jest.mocked(eventsRepo);
const mockGreetingsRepo = jest.mocked(greetingsRepo);
const mockNotesRepo = jest.mocked(notesRepo);

const evento: EventItem = {
  id: 1,
  title: 'Cumple de mamá',
  type: 'cumpleanos',
  date: '1965-07-20',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [{ amount: 1, unit: 'dias', notificationId: 'notif-1' }],
  yearly: 1,
  isMine: 0,
};

const nota: Note = {
  id: 9,
  title: 'Lista del súper',
  content: 'Pan, leche',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const saludo: Greeting = {
  id: 14,
  year: 2026,
  eventId: null,
  name: 'Carla',
  phone: '+54 11 5555-0014',
  greeted: 1,
};

const makeStore = (greetings: Greeting[] = []) =>
  configureStore({
    reducer: {
      events: eventsReducer,
      greetings: greetingsReducer,
      notes: notesReducer,
      settings: settingsReducer,
    },
    preloadedState: {
      events: { items: [evento], status: 'ready' as const },
      greetings: { year: 2026, items: greetings, status: 'ready' as const },
      notes: { items: [nota], status: 'ready' as const },
      settings: { displayName: 'Nico', themePreference: 'sistema' as const, loaded: true },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(scheduleEventReminders).mockResolvedValue([]);
});

describe('exportBackup', () => {
  it('escribe el archivo con todo lo que hay en la app', async () => {
    const store = makeStore();

    const result = await store.dispatch(exportBackup()).unwrap();

    expect(mockSave).toHaveBeenCalledTimes(1);
    const [fileName, content] = mockSave.mock.calls[0];
    expect(fileName).toBe(backupFileName());
    expect(JSON.parse(content)).toMatchObject({
      app: 'crono',
      displayName: 'Nico',
      events: [expect.objectContaining({ title: 'Cumple de mamá' })],
      notes: [expect.objectContaining({ title: 'Lista del súper' })],
    });
    expect(result).toEqual({ events: 1, notes: 1 });
  });

  it('incluye los saludos sin ids locales', async () => {
    const store = makeStore([saludo]);

    await store.dispatch(exportBackup()).unwrap();

    expect(JSON.parse(mockSave.mock.calls[0][1])).toMatchObject({
      greetings: [
        {
          year: 2026,
          eventId: null,
          name: 'Carla',
          phone: '+54 11 5555-0014',
          greeted: 1,
        },
      ],
    });
  });
});

describe('restoreBackup', () => {
  it('agrega solo lo que falta y no duplica lo que ya está', async () => {
    // El backup trae el evento y la nota que YA existen, más una nota nueva.
    const backup = buildBackup(
      [evento],
      [nota, { ...nota, id: 10, title: 'Ideas', content: 'Regalo de Ana' }],
      'Nico',
    );
    mockPick.mockResolvedValue(serializeBackup(backup));
    mockNotesRepo.insertNote.mockResolvedValue({ ...nota, id: 20, title: 'Ideas', content: 'Regalo de Ana' });

    const store = makeStore();
    const summary = await store.dispatch(restoreBackup()).unwrap();

    expect(summary).toEqual({ events: 0, notes: 1, skipped: 2 });
    expect(mockEventsRepo.insertEvent).not.toHaveBeenCalled(); // el evento ya estaba
    expect(mockNotesRepo.insertNote).toHaveBeenCalledWith({ title: 'Ideas', content: 'Regalo de Ana' });
    expect(store.getState().notes.items).toHaveLength(2);
  });

  it('devuelve null si el usuario cancela la elección del archivo', async () => {
    mockPick.mockResolvedValue(null);
    const store = makeStore();

    const summary = await store.dispatch(restoreBackup()).unwrap();

    expect(summary).toBeNull();
    expect(mockNotesRepo.insertNote).not.toHaveBeenCalled();
  });

  it('falla con un mensaje claro si el archivo no es un backup', async () => {
    mockPick.mockResolvedValue('cualquier cosa');
    const store = makeStore();

    await expect(store.dispatch(restoreBackup()).unwrap()).rejects.toBe(
      'El archivo no es un backup válido de Crono.',
    );
  });

  it('restaura los saludos de un backup', async () => {
    mockPick.mockResolvedValue(
      JSON.stringify({
        app: 'crono',
        formatVersion: 1,
        events: [],
        notes: [],
        greetings: [{ year: 2026, eventId: null, name: 'Carla', phone: '+54 11 5555-0014', greeted: 1 }],
      }),
    );
    mockGreetingsRepo.insertGuest.mockResolvedValue(saludo);
    const store = makeStore();

    await store.dispatch(restoreBackup()).unwrap();

    expect(mockGreetingsRepo.insertGuest).toHaveBeenCalledWith(2026, 'Carla', '+54 11 5555-0014', true);
  });
});
