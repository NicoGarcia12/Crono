import { configureStore } from '@reduxjs/toolkit';

import {
  BACKUP_FORMAT_VERSION,
  backupFileName,
  buildBackup,
  serializeBackup,
  type BackupSnapshot,
  type RestoreCounts,
} from '@/backup/backup';
import { pickTextFile, saveAndShare } from '@/backup/file-io';
import * as backupRepo from '@/db/backup-repo';
import * as customFieldsRepo from '@/db/custom-fields-repo';
import * as eventBasesRepo from '@/db/event-bases-repo';
import * as eventTypesRepo from '@/db/event-types-repo';
import * as eventsRepo from '@/db/events-repo';
import * as greetingsRepo from '@/db/greetings-repo';
import * as greetingsSentRepo from '@/db/greetings-sent-repo';
import * as notesRepo from '@/db/notes-repo';
import * as settingsRepo from '@/db/settings-repo';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import eventBasesReducer from '@/store/event-bases-slice';
import eventTypesReducer from '@/store/event-types-slice';
import eventsReducer from '@/store/events-slice';
import fieldValuesReducer from '@/store/field-values-slice';
import giftIdeasReducer from '@/store/gift-ideas-slice';
import greetingsReducer from '@/store/greetings-slice';
import greetingsSentReducer from '@/store/greetings-sent-slice';
import notesReducer from '@/store/notes-slice';
import settingsReducer from '@/store/settings-slice';
import { exportBackup, restoreBackup } from '@/store/backup-slice';
import type { EventItem, EventReminder, Note } from '@/types';

// Límites del sistema mockeados: archivos, BD y notificaciones. La lógica de
// SQLite real (transacción, dedupe, vínculos) se prueba en scripts/test-backup.cjs.
jest.mock('@/backup/file-io');
jest.mock('@/db/backup-repo');
jest.mock('@/db/custom-fields-repo');
jest.mock('@/db/event-bases-repo');
jest.mock('@/db/event-types-repo');
jest.mock('@/db/events-repo');
jest.mock('@/db/greetings-repo');
jest.mock('@/db/greetings-sent-repo');
jest.mock('@/db/notes-repo');
jest.mock('@/db/settings-repo');
jest.mock('@/notifications/notifications');

const mockPick = jest.mocked(pickTextFile);
const mockSave = jest.mocked(saveAndShare);
const mockRepo = jest.mocked(backupRepo);
const mockSchedule = jest.mocked(scheduleEventReminders);
const mockCancel = jest.mocked(cancelReminders);

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
  tags: [],
  photoUri: null,
  yearUnknown: 0,
};

const nota: Note = {
  id: 9,
  title: 'Lista del súper',
  content: 'Pan, leche',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
};

const snapshot = (over: Partial<BackupSnapshot> = {}): BackupSnapshot => ({
  displayName: 'Nico',
  events: [evento],
  notes: [nota],
  greetings: [],
  greetingsSent: [],
  bases: [],
  types: [],
  fields: [],
  fieldValues: {},
  ...over,
});

const counts = (over: Partial<RestoreCounts> = {}): RestoreCounts => ({
  events: 0, notes: 0, greetings: 0, greetingsSent: 0, skipped: 0, droppedFieldValues: 0, unlinkedGreetings: 0,
  unknownTypeEvents: 0, skippedTypes: 0, keptLocalTypes: 0, ownBirthdayKept: false, displayNameRestored: false,
  sourceFormatVersion: BACKUP_FORMAT_VERSION, ...over,
});

/** El store arranca VACÍO a propósito: el backup no debe depender de lo que Redux cargó. */
const makeStore = () =>
  configureStore({
    reducer: {
      events: eventsReducer,
      eventBases: eventBasesReducer,
      eventTypes: eventTypesReducer,
      fieldValues: fieldValuesReducer,
      giftIdeas: giftIdeasReducer,
      greetings: greetingsReducer,
      greetingsSent: greetingsSentReducer,
      notes: notesReducer,
      settings: settingsReducer,
    },
  });

const fileWith = (over: Partial<BackupSnapshot> = {}) => serializeBackup(buildBackup(snapshot(over)));

beforeEach(() => {
  jest.resetAllMocks();
  // Las recargas posteriores a restaurar leen SQLite: aquí devuelven lo que "quedó" en la base.
  jest.mocked(eventsRepo.findAllEvents).mockResolvedValue([evento]);
  jest.mocked(eventBasesRepo.findAllEventBases).mockResolvedValue([]);
  jest.mocked(eventBasesRepo.findAllCustomFields).mockResolvedValue([]);
  jest.mocked(eventTypesRepo.findAllEventTypes).mockResolvedValue([]);
  jest.mocked(customFieldsRepo.findAllFieldValues).mockResolvedValue({});
  jest.mocked(notesRepo.findAllNotes).mockResolvedValue([nota]);
  jest.mocked(settingsRepo.getSetting).mockResolvedValue('Nico');
  jest.mocked(greetingsRepo.findGreetingsByYear).mockResolvedValue([]);
  jest.mocked(greetingsSentRepo.findGreetingsSentByYear).mockResolvedValue([]);
  mockSchedule.mockResolvedValue([]);
  mockCancel.mockResolvedValue(undefined);
});

describe('exportBackup', () => {
  it('lee SQLite (no Redux): el archivo trae todo aunque ninguna pantalla se haya visitado', async () => {
    mockRepo.readBackupSnapshot.mockResolvedValue(
      snapshot({
        greetings: [
          { id: 1, year: 2024, eventId: 1, name: 'Mamá', phone: null, greeted: 1 },
          { id: 2, year: 2026, eventId: null, name: 'Carla', phone: '+54 11 5555-0014', greeted: 1 },
        ],
        greetingsSent: [{ id: 1, year: 2025, eventId: 1, greeted: 1 }],
      }),
    );
    const store = makeStore();
    expect(store.getState().greetings.items).toEqual([]);
    expect(store.getState().events.items).toEqual([]);

    const result = await store.dispatch(exportBackup()).unwrap();

    expect(mockSave).toHaveBeenCalledTimes(1);
    const [fileName, content] = mockSave.mock.calls[0];
    expect(fileName).toBe(backupFileName());
    expect(JSON.parse(content)).toMatchObject({
      app: 'crono',
      formatVersion: 2,
      excludes: ['photos', 'giftIdeas'],
      displayName: 'Nico',
      events: [expect.objectContaining({ title: 'Cumple de mamá', ref: 'e1' })],
      notes: [expect.objectContaining({ title: 'Lista del súper' })],
      greetings: [
        { year: 2024, name: 'Mamá', phone: null, greeted: 1, eventRef: 'e1' },
        { year: 2026, name: 'Carla', phone: '+54 11 5555-0014', greeted: 1, eventRef: null },
      ],
      greetingsSent: [{ year: 2025, eventRef: 'e1', greeted: 1 }],
    });
    expect(result).toEqual({ events: 1, notes: 1, greetings: 2, greetingsSent: 1 });
  });

  it('si no se puede leer la base, no escribe un archivo incompleto', async () => {
    mockRepo.readBackupSnapshot.mockRejectedValue(new Error('base bloqueada'));

    await expect(makeStore().dispatch(exportBackup()).unwrap()).rejects.toMatchObject({ message: 'base bloqueada' });
    expect(mockSave).not.toHaveBeenCalled();
  });
});

describe('restoreBackup', () => {
  it('programa avisos solo de los eventos que faltan, escribe todo junto y recarga Redux desde SQLite', async () => {
    const second = { ...evento, id: 2, title: 'Turno', reminders: [] };
    mockPick.mockResolvedValue(fileWith({ events: [evento, second] }));
    mockRepo.findMissingEventIndexes.mockResolvedValue([1]); // el primero ya estaba
    const scheduled: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'nuevo' }];
    mockSchedule.mockResolvedValue(scheduled);
    mockRepo.applyBackupRestore.mockResolvedValue(counts({ events: 1, skipped: 2, notes: 0 }));
    const store = makeStore();

    const summary = await store.dispatch(restoreBackup()).unwrap();

    expect(mockSchedule).toHaveBeenCalledTimes(1);
    expect(mockSchedule).toHaveBeenCalledWith(expect.objectContaining({ title: 'Turno' }));
    expect(mockRepo.applyBackupRestore).toHaveBeenCalledTimes(1);
    const [backup, byIndex] = mockRepo.applyBackupRestore.mock.calls[0];
    expect(backup.events).toHaveLength(2);
    expect([...byIndex.entries()]).toEqual([[1, scheduled]]);
    expect(summary).toEqual({ ...counts({ events: 1, skipped: 2 }), discarded: 0, refreshFailed: false });
    // Redux quedó igual a lo que hay en la base, no a lo que "agregó" el thunk.
    expect(store.getState().events.items).toEqual([evento]);
    expect(store.getState().notes.items).toEqual([nota]);
    expect(store.getState().settings.displayName).toBe('Nico');
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('cuenta lo dañado del archivo en el resumen', async () => {
    mockPick.mockResolvedValue(
      JSON.stringify({
        app: 'crono', formatVersion: 2, notes: [],
        events: [{ title: 'Ok', type: 'evento', date: '2026-01-01', yearly: 0 }, { title: 'Roto' }],
      }),
    );
    mockRepo.findMissingEventIndexes.mockResolvedValue([0]);
    mockRepo.applyBackupRestore.mockResolvedValue(counts({ events: 1 }));

    const summary = await makeStore().dispatch(restoreBackup()).unwrap();

    expect(summary?.discarded).toBe(1);
  });

  it('devuelve null si el usuario cancela la elección del archivo', async () => {
    mockPick.mockResolvedValue(null);

    const summary = await makeStore().dispatch(restoreBackup()).unwrap();

    expect(summary).toBeNull();
    expect(mockRepo.applyBackupRestore).not.toHaveBeenCalled();
  });

  it('falla con un mensaje claro si el archivo no es un backup, sin tocar nada', async () => {
    mockPick.mockResolvedValue('cualquier cosa');

    await expect(makeStore().dispatch(restoreBackup()).unwrap()).rejects.toBe(
      'El archivo no es un backup válido de Crono.',
    );
    expect(mockRepo.findMissingEventIndexes).not.toHaveBeenCalled();
    expect(mockRepo.applyBackupRestore).not.toHaveBeenCalled();
  });

  it('ante un rechazo de SQLite cancela los avisos recién creados, no recarga y dice que no se modificó nada', async () => {
    mockPick.mockResolvedValue(fileWith());
    mockRepo.findMissingEventIndexes.mockResolvedValue([0]);
    const scheduled: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'nuevo' }];
    mockSchedule.mockResolvedValue(scheduled);
    mockRepo.applyBackupRestore
      .mockRejectedValueOnce(new Error('SQLite sin espacio'))
      .mockResolvedValueOnce(counts({ events: 1 }));
    const store = makeStore();

    await expect(store.dispatch(restoreBackup()).unwrap()).rejects.toMatchObject({
      message: 'SQLite sin espacio\nNo se modificó ningún dato: podés volver a intentarlo.',
    });
    expect(mockCancel).toHaveBeenCalledWith(scheduled);
    expect(store.getState().events.items).toEqual([]); // no se recargó nada
    expect(jest.mocked(eventsRepo.findAllEvents)).not.toHaveBeenCalled();

    // Reintentar con el mismo archivo funciona.
    const summary = await store.dispatch(restoreBackup()).unwrap();
    expect(summary?.events).toBe(1);
  });

  it('si programar un aviso falla, cancela los anteriores y no escribe nada', async () => {
    const second = { ...evento, id: 2, title: 'Turno' };
    mockPick.mockResolvedValue(fileWith({ events: [evento, second] }));
    mockRepo.findMissingEventIndexes.mockResolvedValue([0, 1]);
    const first: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'uno' }];
    mockSchedule.mockResolvedValueOnce(first).mockRejectedValueOnce(new Error('Permiso de avisos revocado'));

    await expect(makeStore().dispatch(restoreBackup()).unwrap()).rejects.toMatchObject({
      message: expect.stringContaining('Permiso de avisos revocado'),
    });
    expect(mockCancel).toHaveBeenCalledWith(first);
    expect(mockRepo.applyBackupRestore).not.toHaveBeenCalled();
  });

  it('si la agenda cambió entre planificar y escribir, aborta y cancela los avisos ya programados', async () => {
    mockPick.mockResolvedValue(fileWith());
    mockRepo.findMissingEventIndexes.mockResolvedValue([0]);
    const scheduled: EventReminder[] = [{ amount: 1, unit: 'dias', notificationId: 'planificado' }];
    mockSchedule.mockResolvedValue(scheduled);
    mockRepo.applyBackupRestore.mockRejectedValue(
      new Error('La agenda cambió mientras se restauraba la copia (otro guardado en curso).'),
    );
    const store = makeStore();

    await expect(store.dispatch(restoreBackup()).unwrap()).rejects.toMatchObject({
      message: expect.stringMatching(/La agenda cambió[\s\S]*No se modificó ningún dato/),
    });
    expect(mockCancel).toHaveBeenCalledWith(scheduled);
    expect(store.getState().events.items).toEqual([]);
  });

  it('si el SO no puede cancelar un aviso, deja constancia con sus ids y conserva el error original', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockPick.mockResolvedValue(fileWith());
    mockRepo.findMissingEventIndexes.mockResolvedValue([0]);
    mockSchedule.mockResolvedValue([{ amount: 1, unit: 'dias', notificationId: 'huerfano-1' }]);
    mockRepo.applyBackupRestore.mockRejectedValue(new Error('SQLite sin espacio'));
    mockCancel.mockRejectedValue(new Error('El SO no pudo cancelar'));

    await expect(makeStore().dispatch(restoreBackup()).unwrap()).rejects.toMatchObject({
      message: expect.stringContaining('SQLite sin espacio'),
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('huerfano-1'), expect.any(Error));
    warn.mockRestore();
  });

  it('si la copia se escribió pero una recarga falla, lo informa en vez de aparentar un fallo', async () => {
    mockPick.mockResolvedValue(fileWith());
    mockRepo.findMissingEventIndexes.mockResolvedValue([]);
    mockRepo.applyBackupRestore.mockResolvedValue(counts({ skipped: 2 }));
    jest.mocked(notesRepo.findAllNotes).mockRejectedValue(new Error('lectura fallida'));

    const summary = await makeStore().dispatch(restoreBackup()).unwrap();

    expect(summary?.refreshFailed).toBe(true);
  });
});
