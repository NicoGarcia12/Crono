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
  yearUnknown: 0,
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
          yearUnknown: 0,
        },
      ],
      notes: [{ title: 'Lista del súper', content: 'Pan, leche' }],
    });
  });
});

describe('backup de tipos propios y campos', () => {
  const config = {
    bases: [
      { id: 1, key: 'cumpleanos', label: 'Cumpleaños', yearly: true, requiresTime: false, capabilities: ['edad' as const], isBuiltin: true },
      { id: 6, key: 'base_mascota', label: 'Mascota', yearly: true, requiresTime: false, capabilities: ['edad' as const], isBuiltin: false },
    ],
    types: [
      {
        id: 20, key: 'firulais', label: 'Mascota', icon: 'paw', color: '#795548', defaultYearly: true,
        isBuiltin: false, baseKey: 'base_mascota', extraCapabilities: ['regalos' as const],
      },
    ],
    fields: [
      { id: 3, owner: 'base' as const, ownerId: 6, label: 'Especie', kind: 'select' as const, options: ['Perro', 'Gato'], position: 0 },
      { id: 4, owner: 'type' as const, ownerId: 20, label: 'Juguetes', kind: 'multi' as const, options: ['Pelota', 'Hueso'], position: 0 },
    ],
    values: { 7: { 3: 'Perro', 4: '["Pelota"]' } },
  };
  const firulais = evento({ id: 7, title: 'Firulais', type: 'firulais' });

  it('exporta solo las bases y tipos propios, y los valores por nombre de campo', () => {
    const backup = buildBackup([firulais], [], 'Nico', new Date(2026, 6, 12), undefined, config);

    expect(backup.typeConfig).toEqual({
      bases: [{
        key: 'base_mascota', label: 'Mascota', yearly: true, requiresTime: false, capabilities: ['edad'],
        fields: [{ label: 'Especie', kind: 'select', options: ['Perro', 'Gato'] }],
      }],
      types: [{
        key: 'firulais', label: 'Mascota', icon: 'paw', color: '#795548', baseKey: 'base_mascota',
        extraCapabilities: ['regalos'], fields: [{ label: 'Juguetes', kind: 'multi', options: ['Pelota', 'Hueso'] }],
      }],
    });
    expect(backup.events[0].fieldValues).toEqual({ 'base:Especie': 'Perro', 'type:Juguetes': '["Pelota"]' });
  });

  it('ida y vuelta: el archivo exportado se vuelve a leer igual', () => {
    const backup = buildBackup([firulais], [], 'Nico', new Date(2026, 6, 12), undefined, config);
    const parsed = parseBackup(serializeBackup(backup));

    expect(parsed.ok && parsed.backup.typeConfig).toEqual(backup.typeConfig);
    expect(parsed.ok && parsed.backup.events[0].fieldValues).toEqual(backup.events[0].fieldValues);
  });

  it('un backup viejo, sin configuración de tipos, se sigue leyendo', () => {
    const viejo = buildBackup([evento({ id: 1 })], [], 'Nico', new Date(2026, 6, 12));
    const parsed = parseBackup(serializeBackup(viejo));

    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.backup.typeConfig).toBeUndefined();
  });

  it('descarta campos y capacidades inválidos del archivo', () => {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 1, displayName: null, notes: [],
      events: [{ title: 'X', type: 'evento', date: '2026-01-01', yearly: 0 }],
      typeConfig: {
        bases: [{ key: 'base_x', label: 'X', capabilities: ['edad', 'volar'], fields: [{ label: 'A', kind: 'fecha' }] }],
        types: [{ key: 'sin_base', label: 'Y' }],
      },
    });
    const parsed = parseBackup(raw);

    expect(parsed.ok && parsed.backup.typeConfig).toEqual({
      bases: [{ key: 'base_x', label: 'X', yearly: false, requiresTime: false, capabilities: ['edad'], fields: [] }],
      types: [],
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
