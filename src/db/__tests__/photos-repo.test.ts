import type { File } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { notify } from '@/components/confirm';
import { getDb } from '@/db/database';
import { insertEvent } from '@/db/events-repo';
import { saveProfilePhoto } from '@/db/photos-repo';
import { deletePhoto, savePhoto, savedPhotos } from '@/media/photos';
import type { NewEvent } from '@/types';

jest.mock('@/db/database', () => ({ getDb: jest.fn() }));
jest.mock('@/components/confirm', () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : String(error)),
  notify: jest.fn(),
}));
jest.mock('@/media/photos', () => ({
  photoFileName: (uri: string) => uri.slice(uri.lastIndexOf('/') + 1),
  savePhoto: jest.fn(),
  savedPhotos: jest.fn(),
  deletePhoto: jest.fn(),
}));

const OLD = 'file:///docs/photos/perfil-1-0.jpg';
const NEW = 'file:///docs/photos/perfil-2-0.jpg';
const SHARED = 'file:///docs/photos/evento-1-0.jpg';
const PICKED = 'file:///cache/ImagePicker/elegida.jpg';

/** Disco y SQLite falsos: `log` conserva el orden real entre copiar, escribir y borrar. */
let disk: Set<string>;
let profilePhoto: string;
let eventPhotos: string[];
let log: string[];

function makeDatabase(): SQLiteDatabase {
  const db = {
    async runAsync(sql: string, ...params: unknown[]) {
      if (sql.includes('INSERT INTO settings')) {
        profilePhoto = String(params[1]);
        log.push('sql:setting');
      } else if (sql.includes('INSERT INTO events')) {
        eventPhotos.push(String(params.at(-2)));
        log.push('sql:event');
      }
      return { lastInsertRowId: 1, changes: 1 };
    },
    async getAllAsync(sql: string) {
      if (!sql.includes('photo_uri AS uri')) return [];
      return [...eventPhotos, ...(profilePhoto ? [profilePhoto] : [])].map((uri) => ({ uri }));
    },
    async getFirstAsync() {
      return null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      await task();
    },
    async withExclusiveTransactionAsync(task: (transaction: object) => Promise<void>): Promise<void> {
      await task(db);
    },
  };
  // REASON: el repositorio depende de una interfaz nativa grande; el doble implementa lo que ejercitan las pruebas.
  return db as unknown as SQLiteDatabase;
}

const evento: NewEvent = {
  title: 'Mamá', type: 'cumpleanos', date: '1960-08-01', time: null, description: null, contactId: null,
  phone: null, reminders: [], yearly: 1, isMine: 0, tags: [], photoUri: PICKED, yearUnknown: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  disk = new Set([OLD, SHARED]);
  profilePhoto = OLD;
  eventPhotos = [SHARED];
  log = [];
  jest.mocked(getDb).mockReturnValue(makeDatabase());
  // REASON: la limpieza sólo lee `uri` de cada archivo del inventario.
  jest.mocked(savedPhotos).mockImplementation(() => [...disk].map((uri) => ({ uri }) as File));
  jest.mocked(deletePhoto).mockImplementation((uri) => {
    log.push(`delete:${uri}`);
    disk.delete(uri);
  });
  jest.mocked(savePhoto).mockImplementation(async () => {
    log.push('copy');
    disk.add(NEW);
    return NEW;
  });
});

describe('foto de perfil', () => {
  it('con la copia pendiente SQLite sigue apuntando a la foto anterior', async () => {
    let finishCopy!: (uri: string) => void;
    jest.mocked(savePhoto).mockImplementation(() => new Promise<string>((resolve) => { finishCopy = resolve; }));

    const saving = saveProfilePhoto(PICKED);
    await new Promise((resolve) => setImmediate(resolve));
    expect(profilePhoto).toBe(OLD);
    expect(log).toEqual([]);

    disk.add(NEW);
    finishCopy(NEW);
    await expect(saving).resolves.toBe(NEW);
    expect(profilePhoto).toBe(NEW);
  });

  it('si la copia rechaza conserva la anterior y limpia la copia parcial', async () => {
    const partial = 'file:///docs/photos/perfil-3-0.jpg';
    jest.mocked(savePhoto).mockImplementation(async () => {
      disk.add(partial);
      throw new Error('disco lleno');
    });

    await expect(saveProfilePhoto(PICKED)).rejects.toThrow('disco lleno');

    expect(profilePhoto).toBe(OLD);
    expect(disk).toEqual(new Set([OLD, SHARED]));
    expect(jest.mocked(deletePhoto).mock.calls.flat()).toEqual([partial]);
  });

  it('confirma en SQLite antes de borrar la foto reemplazada y respeta las compartidas', async () => {
    await expect(saveProfilePhoto(PICKED)).resolves.toBe(NEW);

    expect(log).toEqual(['copy', 'sql:setting', `delete:${OLD}`]);
    expect(disk).toEqual(new Set([NEW, SHARED]));
  });

  it('quitar la foto no copia nada y borra la anterior sólo si nadie más la usa', async () => {
    eventPhotos = [OLD, SHARED];
    await saveProfilePhoto(null);
    expect(savePhoto).not.toHaveBeenCalled();
    expect(deletePhoto).not.toHaveBeenCalled();

    eventPhotos = [];
    await saveProfilePhoto(null);
    expect(jest.mocked(deletePhoto).mock.calls.flat()).toEqual([OLD, SHARED]);
  });

  it('un fallo al borrar no deshace el guardado: avisa y la siguiente limpieza reintenta', async () => {
    jest.mocked(deletePhoto).mockImplementationOnce(() => { throw new Error('bloqueado'); });

    await expect(saveProfilePhoto(PICKED)).resolves.toBe(NEW);

    expect(profilePhoto).toBe(NEW);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(disk.has(OLD)).toBe(true);

    await saveProfilePhoto(NEW);
    expect(disk.has(OLD)).toBe(false);
  });
});

describe('foto de evento', () => {
  it('copia la elegida antes del INSERT y guarda la URI persistida', async () => {
    const saved = await insertEvent(evento, []);

    expect(log.slice(0, 2)).toEqual(['copy', 'sql:event']);
    expect(saved.photoUri).toBe(NEW);
    expect(eventPhotos).toContain(NEW);
  });

  it('si la copia rechaza no inserta el evento', async () => {
    jest.mocked(savePhoto).mockRejectedValue(new Error('sin permiso'));

    await expect(insertEvent(evento, [])).rejects.toThrow('sin permiso');

    expect(log).not.toContain('sql:event');
  });
});
