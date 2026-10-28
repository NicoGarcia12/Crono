import {
  BACKUP_FORMAT_VERSION,
  backupFileName,
  buildBackup,
  describeRestore,
  greetingKey,
  matchBackupEvents,
  matchExisting,
  parseBackup,
  serializeBackup,
  type BackupSnapshot,
  type RestoreSummary,
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

const snapshot = (over: Partial<BackupSnapshot> = {}): BackupSnapshot => ({
  displayName: 'Nico',
  events: [],
  notes: [],
  greetings: [],
  greetingsSent: [],
  bases: [],
  types: [],
  fields: [],
  fieldValues: {},
  ...over,
});

const NOW = new Date('2026-07-12T12:00:00Z');

const summary = (over: Partial<RestoreSummary> = {}): RestoreSummary => ({
  events: 1, notes: 0, greetings: 0, greetingsSent: 0, skipped: 0, discarded: 0, droppedFieldValues: 0,
  unlinkedGreetings: 0, unknownTypeEvents: 0, skippedTypes: 0, keptLocalTypes: 0, ownBirthdayKept: false,
  displayNameRestored: false, sourceFormatVersion: BACKUP_FORMAT_VERSION, refreshFailed: false, ...over,
});

describe('buildBackup', () => {
  it('guarda eventos y notas sin los ids ni los ids de notificación (son de este celular)', () => {
    const backup = buildBackup(
      snapshot({
        events: [evento({ id: 1, tags: [{ id: 5, name: 'familia' }], photoUri: 'file:///foto.jpg' })],
        notes: [nota({ id: 9 })],
      }),
      NOW,
    );

    expect(backup).toEqual({
      app: 'crono',
      formatVersion: 2,
      exportedAt: '2026-07-12T12:00:00.000Z',
      excludes: ['photos', 'giftIdeas'], // el contrato declara lo que NO viaja
      displayName: 'Nico',
      events: [
        {
          ref: 'e1',
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
      greetings: [],
      greetingsSent: [],
      typeConfig: { bases: [], types: [], builtinTypes: [] },
    });
  });

  it('exporta los saludos de todos los años enlazados a su evento por ref, no por id local', () => {
    const backup = buildBackup(
      snapshot({
        events: [evento({ id: 10, title: 'Ana' }), evento({ id: 11, title: 'Luis' })],
        greetings: [
          { id: 1, year: 2024, eventId: 11, name: 'Luis', phone: null, greeted: 1 },
          { id: 2, year: 2025, eventId: null, name: 'Invitado', phone: '+54 11 5555-0000', greeted: 0 },
          { id: 3, year: 2025, eventId: 999, name: 'Evento borrado', phone: null, greeted: 1 },
        ],
        greetingsSent: [
          { id: 1, year: 2024, eventId: 10, greeted: 1 },
          { id: 2, year: 2025, eventId: 777, greeted: 1 },
        ],
      }),
      NOW,
    );

    expect(backup.greetings).toEqual([
      { year: 2024, name: 'Luis', phone: null, greeted: 1, eventRef: 'e2' },
      { year: 2025, name: 'Invitado', phone: '+54 11 5555-0000', greeted: 0, eventRef: null },
      // El de un evento inexistente es un huérfano: no se exporta (ni como invitado).
    ]);
    // Una marca sin evento en el snapshot no puede enlazarse: no se escribe una referencia rota.
    expect(backup.greetingsSent).toEqual([{ year: 2024, eventRef: 'e1', greeted: 1 }]);
  });

  describe('tipos propios, personalización de fábrica y campos', () => {
    const config = snapshot({
      bases: [
        { id: 1, key: 'cumpleanos', label: 'Cumpleaños', yearly: true, requiresTime: false, capabilities: ['edad'], isBuiltin: true },
        { id: 6, key: 'base_mascota', label: 'Mascota', yearly: true, requiresTime: false, capabilities: ['edad'], isBuiltin: false },
      ],
      types: [
        {
          id: 2, key: 'cumpleanos', label: 'Cumples', icon: 'balloon', color: '#112233', defaultYearly: true,
          isBuiltin: true, baseKey: 'cumpleanos', extraCapabilities: [], hidden: false,
        },
        {
          id: 3, key: 'mi_cumpleanos', label: 'Mi cumpleaños', icon: 'gift', color: '#E91E63', defaultYearly: true,
          isBuiltin: true, baseKey: 'cumpleanos', extraCapabilities: [], hidden: true,
        },
        {
          id: 20, key: 'firulais', label: 'Mascota', icon: 'paw', color: '#795548', defaultYearly: true,
          isBuiltin: false, baseKey: 'base_mascota', extraCapabilities: ['regalos'], hidden: false,
        },
      ],
      fields: [
        { id: 3, owner: 'base', ownerId: 6, label: 'Especie', kind: 'select', options: ['Perro', 'Gato'], position: 0, required: false },
        { id: 4, owner: 'type', ownerId: 20, label: 'Juguetes', kind: 'multi', options: ['Pelota', 'Hueso'], position: 0, required: true },
      ],
      fieldValues: { 7: { 3: 'Perro', 4: '["Pelota"]' } },
      events: [evento({ id: 7, title: 'Firulais', type: 'firulais' })],
    });

    it('exporta bases y tipos propios, la personalización de los de fábrica y los valores por nombre de campo', () => {
      const backup = buildBackup(config, NOW);

      expect(backup.typeConfig).toEqual({
        bases: [{
          key: 'base_mascota', label: 'Mascota', yearly: true, requiresTime: false, capabilities: ['edad'],
          fields: [{ label: 'Especie', kind: 'select', options: ['Perro', 'Gato'], required: false }],
        }],
        types: [{
          key: 'firulais', label: 'Mascota', icon: 'paw', color: '#795548', baseKey: 'base_mascota',
          extraCapabilities: ['regalos'], fields: [{ label: 'Juguetes', kind: 'multi', options: ['Pelota', 'Hueso'], required: true }],
        }],
        // El tipo oculto "Mi cumpleaños" no se personaliza: no viaja.
        builtinTypes: [{ key: 'cumpleanos', label: 'Cumples', icon: 'balloon', color: '#112233' }],
      });
      expect(backup.events[0].fieldValues).toEqual({ 'base:Especie': 'Perro', 'type:Juguetes': '["Pelota"]' });
    });

    it('ida y vuelta: el archivo exportado se vuelve a leer igual', () => {
      const backup = buildBackup(config, NOW);
      const parsed = parseBackup(serializeBackup(backup));

      expect(parsed.ok && parsed.backup).toEqual(backup);
      expect(parsed.ok && parsed.discarded).toEqual({ events: 0, notes: 0, greetings: 0, greetingsSent: 0, types: 0 });
    });
  });
});

describe('contrato de versiones', () => {
  const evento1 = { title: 'X', type: 'evento', date: '2026-01-01', yearly: 0 };

  it('un backup v1 se sigue leyendo; los campos de v2 no se interpretan en un archivo v1', () => {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 1, displayName: null, notes: [],
      events: [{ ...evento1, ref: 'e1' }],
      greetings: [{ year: 2025, eventId: 5, eventRef: 'e1', name: 'Carla', phone: null, greeted: 1 }],
      greetingsSent: [{ year: 2025, eventRef: 'e1', greeted: 1 }],
      typeConfig: { builtinTypes: [{ key: 'cumpleanos', label: 'X', icon: 'x', color: '#000' }] },
    });
    const parsed = parseBackup(raw);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.formatVersion).toBe(1);
    expect(parsed.backup.excludes).toBeUndefined();
    expect(parsed.backup.events[0].ref).toBeNull();
    expect(parsed.backup.greetings).toEqual([{ year: 2025, name: 'Carla', phone: null, greeted: 1, eventRef: null }]);
    expect(parsed.backup.greetingsSent).toBeUndefined();
    expect(parsed.backup.typeConfig).toBeUndefined();
  });

  it.each([3, 99])('rechaza la versión futura %s con un mensaje accionable', (formatVersion) => {
    expect(parseBackup(JSON.stringify({ app: 'crono', formatVersion, events: [evento1], notes: [] }))).toEqual({
      ok: false,
      error: 'El backup viene de una versión más nueva de Crono. Actualizá la app.',
    });
  });

  it.each([0, -1, 1.5, '2', null])('rechaza una versión que no es un entero soportado: %j', (formatVersion) => {
    expect(parseBackup(JSON.stringify({ app: 'crono', formatVersion, events: [evento1], notes: [] }))).toEqual({
      ok: false,
      error: 'El backup no declara una versión de formato válida.',
    });
  });

  it('un ref repetido hace ambiguo el vínculo: solo el primer evento lo conserva', () => {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 2, notes: [],
      events: [{ ...evento1, title: 'A', ref: 'e1' }, { ...evento1, title: 'B', ref: 'e1' }],
    });
    const parsed = parseBackup(raw);

    expect(parsed.ok && parsed.backup.events.map((e) => e.ref)).toEqual(['e1', null]);
  });
});

describe('backup de tipos: lectura defensiva', () => {
  it('un backup sin obligatoriedad por campo: los de una base quedan obligatorios y los de un tipo, no', () => {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 1, displayName: null, notes: [],
      events: [{ title: 'X', type: 'evento', date: '2026-01-01', yearly: 0 }],
      typeConfig: {
        bases: [{ key: 'base_x', label: 'X', fields: [{ label: 'A', kind: 'texto' }] }],
        types: [{ key: 'tipo_x', label: 'Y', icon: 'star', color: '#000', baseKey: 'base_x', fields: [{ label: 'B', kind: 'texto' }] }],
      },
    });
    const parsed = parseBackup(raw);

    expect(parsed.ok && parsed.backup.typeConfig?.bases[0].fields[0].required).toBe(true);
    expect(parsed.ok && parsed.backup.typeConfig?.types[0].fields[0].required).toBe(false);
  });

  it('descarta campos, tipos y capacidades inválidos del archivo y lo cuenta', () => {
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
    // Un campo con clase inventada y un tipo sin baseKey: dos descartes.
    expect(parsed.ok && parsed.discarded.types).toBe(2);
  });

  it('solo acepta como personalización las claves de los tipos de fábrica', () => {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 2, notes: [],
      events: [{ title: 'X', type: 'evento', date: '2026-01-01', yearly: 0 }],
      typeConfig: {
        builtinTypes: [
          { key: 'cumpleanos', label: 'Cumples', icon: 'balloon', color: '#112233' },
          { key: 'inventado', label: 'No', icon: 'x', color: '#000' },
          { key: 'festivo', label: '', icon: 'x', color: '#000' },
        ],
      },
    });
    const parsed = parseBackup(raw);

    expect(parsed.ok && parsed.backup.typeConfig?.builtinTypes).toEqual([
      { key: 'cumpleanos', label: 'Cumples', icon: 'balloon', color: '#112233' },
    ]);
    expect(parsed.ok && parsed.discarded.types).toBe(2);
  });
});

describe('backupFileName', () => {
  it('nombra el archivo con la fecha', () => {
    expect(backupFileName(NOW)).toBe('crono-backup-2026-07-12.json');
  });
});

describe('parseBackup', () => {
  const valido = serializeBackup(buildBackup(snapshot({ events: [evento({ id: 1 })], notes: [nota({ id: 9 })] })));

  it('lee un backup exportado por la app (ida y vuelta)', () => {
    const result = parseBackup(valido);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events).toHaveLength(1);
    expect(result.backup.notes).toHaveLength(1);
    expect(result.backup.displayName).toBe('Nico');
    expect(result.backup.excludes).toEqual(['photos', 'giftIdeas']);
  });

  it('rechaza un archivo que no es JSON', () => {
    expect(parseBackup('esto no es json')).toEqual({ ok: false, error: 'El archivo no es un backup válido de Crono.' });
  });

  it('rechaza un JSON que no es un backup de Crono', () => {
    expect(parseBackup(JSON.stringify({ hola: 'mundo' }))).toEqual({ ok: false, error: 'El archivo no es un backup de Crono.' });
  });

  it('descarta los eventos corruptos, conserva los válidos y cuenta lo descartado', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [
        { title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0, reminders: [] },
        { title: 'Sin fecha', type: 'evento', yearly: 0 },
        { title: 'Sin tipo', type: '', date: '2026-07-20', yearly: 0 },
        { title: 'Fecha rara', type: 'evento', date: '20/07/2026', yearly: 0 },
      ],
      notes: [{ title: '', content: '' }],
      greetings: [{ year: -1, name: 'X', phone: null, greeted: 1 }],
    });

    const result = parseBackup(raw);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.events.map((e) => e.title)).toEqual(['Ok']);
    expect(result.discarded).toEqual({ events: 3, notes: 1, greetings: 1, greetingsSent: 0, types: 0 });
  });

  it('acepta un tipo de evento personalizado (no es un enum cerrado)', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Torneo', type: 'deporte', date: '2026-07-20', yearly: 0 }],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok && result.backup.events[0].type).toBe('deporte');
  });

  it('completa los campos opcionales que falten', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0 }],
      notes: [],
    });

    const result = parseBackup(raw);

    expect(result.ok && result.backup.events[0]).toMatchObject({
      time: null,
      description: null,
      contactId: null,
      phone: null,
      reminders: [], // sin avisos, no rompe
      ref: null,
    });
  });

  it('acepta backups previos que no tenían etiquetas ni saludos', () => {
    const raw = JSON.stringify({
      app: 'crono',
      formatVersion: 1,
      events: [{ title: 'Ok', type: 'evento', date: '2026-07-20', yearly: 0, tags: ['familia', 42, ''] }],
      notes: [],
    });

    const result = parseBackup(raw);

    // Solo strings no vacíos: descarta lo que no sea un nombre de etiqueta válido.
    expect(result).toMatchObject({ ok: true, backup: { greetings: [], events: [{ tags: ['familia'] }] } });
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

    expect(result.ok && result.backup.events[0].reminders).toEqual([{ amount: 1, unit: 'dias' }]);
  });

  it('rechaza un backup vacío', () => {
    expect(parseBackup(JSON.stringify({ app: 'crono', formatVersion: 1, events: [], notes: [] }))).toEqual({
      ok: false,
      error: 'El backup no tiene eventos ni notas para restaurar.',
    });
  });

  it('un backup con puros datos dañados lo dice en vez de parecer vacío', () => {
    const result = parseBackup(JSON.stringify({ app: 'crono', formatVersion: 2, events: [{ title: '' }], notes: [] }));

    expect(result).toEqual({ ok: false, error: 'El backup no tiene datos válidos para restaurar (1 elementos dañados).' });
  });

  it('lee los saludos y las marcas de "ya lo saludé" de v2, y descarta los inválidos', () => {
    const raw = JSON.stringify({
      app: 'crono', formatVersion: 2, notes: [],
      events: [{ title: 'Ana', type: 'cumpleanos', date: '1980-03-03', yearly: 1, ref: 'e1' }],
      greetings: [
        { year: 2024, name: ' Ana ', phone: null, greeted: 1, eventRef: 'e1' },
        { year: 2025, name: 'Invitado', phone: '+54 11 5555-0000', greeted: 0 },
        { year: 2025, name: '', phone: null, greeted: 0 },
      ],
      greetingsSent: [
        { year: 2024, eventRef: 'e1', greeted: 1 },
        { year: 2024, greeted: 1 },
      ],
    });

    const result = parseBackup(raw);

    expect(result.ok && result.backup.greetings).toEqual([
      { year: 2024, name: 'Ana', phone: null, greeted: 1, eventRef: 'e1' },
      { year: 2025, name: 'Invitado', phone: '+54 11 5555-0000', greeted: 0, eventRef: null },
    ]);
    expect(result.ok && result.backup.greetingsSent).toEqual([{ year: 2024, eventRef: 'e1', greeted: 1 }]);
    expect(result.ok && result.discarded).toMatchObject({ greetings: 1, greetingsSent: 1 });
  });
});

describe('emparejamiento con lo que ya existe', () => {
  const backup = buildBackup(
    snapshot({
      events: [evento({ id: 1 }), evento({ id: 2, title: 'Turno médico', type: 'cita_medica', date: '2026-09-10' })],
    }),
  );
  const existing = (over: Partial<EventItem> & { id: number }) => evento(over);

  it('todo falta cuando la agenda está vacía', () => {
    expect(matchBackupEvents(backup.events, [])).toEqual([null, null]);
  });

  it('no duplica lo que ya existe (mismo título, tipo y fecha)', () => {
    const matches = matchBackupEvents(backup.events, [existing({ id: 55 })]);

    expect(matches.map((m) => m?.id ?? null)).toEqual([55, null]);
  });

  it('un evento con el mismo nombre pero otra fecha SÍ se agrega', () => {
    const matches = matchBackupEvents(backup.events, [existing({ id: 55, date: '1970-01-01' })]);

    expect(matches).toEqual([null, null]);
  });

  it('es uno a uno: dos repetidos en el archivo contra uno existente agregan solo el segundo', () => {
    const twice = { ...backup.events[0] };
    const matches = matchBackupEvents([twice, { ...twice }], [existing({ id: 55 })]);

    expect(matches.map((m) => m?.id ?? null)).toEqual([55, null]);
  });

  it('importar dos veces el mismo archivo con repetidos no agrega nada la segunda vez', () => {
    const items = ['a', 'a', 'b'];
    const first = matchExisting<string, string>(items, [], (x) => x, (x) => x);
    const inserted = items.filter((_, i) => first[i] === null);
    const second = matchExisting<string, string>(items, inserted, (x) => x, (x) => x);

    expect(second).toEqual(['a', 'a', 'b']);
  });

  it('un saludo es el mismo si coinciden año, nombre (sin importar mayúsculas) y teléfono', () => {
    expect(greetingKey({ year: 2025, name: ' Carla ', phone: null })).toBe(greetingKey({ year: 2025, name: 'carla', phone: '' }));
    expect(greetingKey({ year: 2025, name: 'Carla', phone: null })).not.toBe(greetingKey({ year: 2024, name: 'Carla', phone: null }));
  });
});

describe('describeRestore', () => {
  it('sin avisos, mantiene el mensaje simple', () => {
    expect(describeRestore(summary({ events: 1, notes: 0 }))).toEqual({
      title: 'Listo',
      message: 'Se restauraron 1 evento y 0 notas.',
    });
  });

  it('lista saludos, lo que ya estaba y TODO lo que no se pudo restaurar', () => {
    const { title, message } = describeRestore(
      summary({
        events: 2, notes: 1, greetings: 3, greetingsSent: 1, skipped: 4, discarded: 2, droppedFieldValues: 1,
        unlinkedGreetings: 1, unknownTypeEvents: 1, skippedTypes: 1, keptLocalTypes: 1, ownBirthdayKept: true,
        displayNameRestored: true, sourceFormatVersion: 1, refreshFailed: true,
      }),
    );

    expect(title).toBe('Listo, con avisos');
    expect(message).toContain('Se restauraron 2 eventos y 1 nota.');
    expect(message).toContain('También 3 saludos y 1 marca de "ya lo saludé".');
    expect(message).toContain('4 ya estaban en tu agenda.');
    expect(message).toContain('Se recuperó tu nombre.');
    expect(message).toContain('2 elementos dañados del archivo se descartaron.');
    expect(message).toContain('1 valor de campo no se pudo restaurar');
    expect(message).toContain('mi cumpleaños');
    expect(message).toContain('formato anterior');
    expect(message).toContain('cerrá y volvé a abrir Crono');
  });
});
