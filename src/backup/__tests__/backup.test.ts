import {
  backupFileName,
  buildBackup,
  itemsToRestore,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from '@/backup/backup';
import type { EventItem, Note } from '@/types';

const evento = (over: Partial<EventItem> & { id: number }): EventItem => ({
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
  ...over,
});

const nota = (over: Partial<Note> & { id: number }): Note => ({
  title: 'Lista del súper',
  content: 'Pan, leche',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z',
  ...over,
});

describe('buildBackup', () => {
  it('guarda eventos y notas sin los ids ni los ids de notificación (son de este celular)', () => {
    const backup = buildBackup(
      [evento({ id: 1, tags: [{ id: 5, name: 'familia' }] })],
      [nota({ id: 9 })],
      'Nico',
      new Date('2026-07-12T12:00:00Z'),
    );

    expect(backup).toEqual({
      app: 'crono',
      formatVersion: 1,
      exportedAt: '2026-07-12T12:00:00.000Z',
      displayName: 'Nico',
      events: [
        {
          title: 'Cumple de mamá',
          type: 'cumpleanos',
          date: '1965-07-20',
          time: null,
          description: null,
          contactId: null,
          phone: null,
          reminders: [{ amount: 1, unit: 'dias' }], // sin notificationId
          yearly: 1,
          isMine: 0,
          tags: ['familia'], // por nombre, sin ids (son de este celular)
          photoUri: null, // nunca viaja en el backup
        },
      ],
      notes: [{ title: 'Lista del súper', content: 'Pan, leche' }],
    });
  });
});

describe('backupFileName', () => {
  it('nombra el archivo con la fecha', () => {
    expect(backupFileName(new Date('2026-07-12T12:00:00Z'))).toBe('crono-backup-2026-07-12.json');
  });
});

describe('parseBackup', () => {
  const valido = serializeBackup(buildBackup([evento({ id: 1 })], [nota({ id: 9 })], 'Nico'));

  it('lee un backup exportado por la app (ida y vuelta)', () => {
    const result = parseBackup(valido);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events).toHaveLength(1);
    expect(result.backup.notes).toHaveLength(1);
    expect(result.backup.displayName).toBe('Nico');
  });

  it('rechaza un archivo que no es JSON', () => {
    const result = parseBackup('esto no es json');

    expect(result).toEqual({ ok: false, error: 'El archivo no es un backup válido de Crono.' });
  });

  it('rechaza un JSON que no es un backup de Crono', () => {
    const result = parseBackup(JSON.stringify({ hola: 'mundo' }));

    expect(result).toEqual({ ok: false, error: 'El archivo no es un backup de Crono.' });
  });

  it('rechaza un backup de una versión futura', () => {
    const result = parseBackup(JSON.stringify({ app: 'crono', formatVersion: 99, events: [], notes: [] }));

    expect(result.ok).toBe(false);
  });

  it('descarta los eventos corruptos y conserva los válidos', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [
        { title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0, reminders: [] },
        { title: 'Sin fecha', type: 'evento', yearly: 0 },
        { title: 'Sin tipo', type: '', date: '2026-07-20', yearly: 0 },
        { title: 'Fecha rara', type: 'evento', date: '20/07/2026', yearly: 0 },
      ],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events.map((e) => e.title)).toEqual(['Ok']);
  });

  it('acepta un tipo de evento personalizado (no es un enum cerrado)', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Torneo', type: 'deporte', date: '2026-07-20', yearly: 0 }],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events[0].type).toBe('deporte');
  });

  it('completa los campos opcionales que falten', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0 }],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events[0]).toMatchObject({
      time: null,
      description: null,
      contactId: null,
      phone: null,
      reminders: [], // sin avisos, no rompe
    });
  });

  it('acepta backups previos que no tenían etiquetas', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0, tags: ['familia', 42, ''] }],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Solo strings no vacíos: descarta lo que no sea un nombre de etiqueta válido.
    expect(result.backup.events[0].tags).toEqual(['familia']);
  });

  it('acepta backups previos que no tenían saludos', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0 }],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result).toMatchObject({ ok: true, backup: { greetings: [] } });
  });

  it('descarta avisos con unidad inventada', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [
        {
          title: 'Ok',
          type: 'evento',
          date: '2026-07-20',
          yearly: 0,
          reminders: [
            { amount: 1, unit: 'dias' },
            { amount: 1, unit: 'siglos' },
          ],
        },
      ],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events[0].reminders).toEqual([{ amount: 1, unit: 'dias' }]);
  });

  it('rechaza un backup vacío', () => {
    const result = parseBackup(JSON.stringify({ app: 'crono', formatVersion: 1, events: [], notes: [] }));

    expect(result.ok).toBe(false);
  });
});

describe('itemsToRestore', () => {
  const backup: BackupFile = buildBackup(
    [evento({ id: 1 }), evento({ id: 2, title: 'Turno médico', type: 'cita_medica', date: '2026-09-10' })],
    [nota({ id: 9 }), nota({ id: 10, title: 'Ideas', content: 'Regalo de Ana' })],
    'Nico',
  );

  it('agrega todo cuando la agenda está vacía', () => {
    const { events, notes } = itemsToRestore(backup, [], []);

    expect(events).toHaveLength(2);
    expect(notes).toHaveLength(2);
  });

  it('no duplica lo que ya existe (mismo título, tipo y fecha)', () => {
    const { events, notes } = itemsToRestore(backup, [evento({ id: 55 })], [nota({ id: 77 })]);

    expect(events.map((e) => e.title)).toEqual(['Turno médico']);
    expect(notes.map((n) => n.title)).toEqual(['Ideas']);
  });

  it('un evento con el mismo nombre pero otra fecha SÍ se agrega', () => {
    const otro = evento({ id: 55, date: '1970-01-01' });

    const { events } = itemsToRestore(backup, [otro], []);

    expect(events).toHaveLength(2);
  });
});
