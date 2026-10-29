import { CAPABILITIES, EVENT_TYPES, FIELD_KINDS, REMINDER_UNITS } from '@/types';
import type {
  BuiltinEventType,
  Capability,
  CustomField,
  EventBase,
  EventItem,
  EventTypeMeta,
  FieldKind,
  FieldValues,
  Greeting,
  GreetingSent,
  NewEvent,
  NewNote,
  Note,
  ReminderInput,
} from '@/types';

/**
 * Copia de seguridad: exportar toda la agenda a un archivo de texto (JSON) y
 * volver a importarla en este u otro celular.
 *
 * 💡 Aprendizaje: los datos viven solo en el celular (SQLite). Si se pierde el
 * teléfono, se pierde todo — por eso una app así necesita export/import. El
 * archivo se versiona (`formatVersion`) para poder cambiar el formato mañana
 * sin romper los backups viejos.
 *
 * CONTRATO DE VERSIONES
 * - v2 (actual): lo que escribe la app. Agrega a v1: `ref` en cada evento
 *   (identificador SOLO válido dentro del archivo), saludos y marcas de
 *   "ya lo saludé" de TODOS los años enlazados a su evento por ese `ref`,
 *   la personalización de los tipos de fábrica (`typeConfig.builtinTypes`) y
 *   la declaración `excludes`.
 * - v1: se sigue leyendo. No trae `ref`, ni "ya lo saludé", ni tipos de
 *   fábrica personalizados, y sus saludos eran invitados sin vínculo (el
 *   formato v1 nunca guardó a qué evento apuntaban): se restauran como
 *   invitados. Un archivo v1 NO se reinterpreta con campos de v2 aunque los
 *   traiga.
 * - Una versión mayor que la de esta app se rechaza; una menor que 1 o que no
 *   es entera, también.
 * - Quedan EXCLUIDOS en cualquier versión: las fotos (de eventos y de perfil)
 *   y las ideas de regalo. Un restore nunca los borra ni los modifica.
 */

export const BACKUP_FORMAT_VERSION = 2;
export const MIN_SUPPORTED_FORMAT_VERSION = 1;

/** Datos que el formato deja afuera a propósito (se declaran en cada archivo v2). */
export const BACKUP_EXCLUDES = ['photos', 'giftIdeas'] as const;
export type BackupExclusion = (typeof BACKUP_EXCLUDES)[number];

/**
 * Un saludo recibido. No conserva ids del celular de origen: si apuntaba a un
 * evento de la agenda, lo hace por el `ref` de ese evento dentro del archivo.
 * `eventRef: null` = invitado anotado a mano.
 */
export interface BackupGreeting {
  year: number;
  name: string;
  phone: string | null;
  greeted: 0 | 1;
  eventRef: string | null;
}

/** "Ya lo saludé" de un año para un evento del archivo. */
export interface BackupGreetingSent {
  year: number;
  eventRef: string;
  greeted: 0 | 1;
}

/** Un campo personalizado sin ids: se reconoce por su dueño y su nombre. */
export interface BackupField {
  label: string;
  kind: FieldKind;
  options: string[];
  required: boolean;
}

export interface BackupBase {
  key: string;
  label: string;
  yearly: boolean;
  requiresTime: boolean;
  capabilities: Capability[];
  fields: BackupField[];
}

export interface BackupType {
  key: string;
  label: string;
  icon: string;
  color: string;
  baseKey: string;
  extraCapabilities: Capability[];
  fields: BackupField[];
}

/** Lo único que el usuario puede cambiar de un tipo de fábrica: cómo se ve. */
export interface BackupBuiltinType {
  key: BuiltinEventType;
  label: string;
  icon: string;
  color: string;
}

/** Bases y tipos PROPIOS, más cómo personalizó el usuario los tipos de fábrica (v2). */
export interface BackupTypeConfig {
  bases: BackupBase[];
  types: BackupType[];
  builtinTypes?: BackupBuiltinType[];
}

/**
 * Un evento del backup. Los valores de sus campos van por clave
 * 'base:Obra social' / 'type:Qué llevar', porque los ids son de ESTE celular.
 * `ref` (v2) identifica al evento dentro del archivo para los saludos.
 */
export type BackupEvent = Omit<NewEvent, 'fieldValues'> & {
  ref: string | null;
  fieldValues?: Record<string, string>;
};

export interface BackupFile {
  app: 'crono';
  formatVersion: number;
  exportedAt: string;
  /** Qué no viaja en este archivo (siempre presente en v2). */
  excludes?: BackupExclusion[];
  displayName: string | null;
  events: BackupEvent[];
  notes: NewNote[];
  /** Opcional: los backups anteriores a la lista de saludos no lo traen. */
  greetings?: BackupGreeting[];
  /** v2: "ya lo saludé" de todos los años. */
  greetingsSent?: BackupGreetingSent[];
  /** Opcional: los backups anteriores a los tipos componibles no lo traen. */
  typeConfig?: BackupTypeConfig;
}

/** Clave estable de un campo dentro de un evento: dueño + nombre. */
export function backupFieldKey(field: Pick<CustomField, 'owner' | 'label'>): string {
  return `${field.owner}:${field.label}`;
}

/**
 * Todo lo que se exporta, leído de SQLite (ver db/backup-repo.ts). Son tipos de
 * la app con sus ids locales: `buildBackup` los traduce a referencias del archivo.
 */
export interface BackupSnapshot {
  displayName: string | null;
  events: EventItem[];
  notes: Note[];
  greetings: Greeting[];
  greetingsSent: GreetingSent[];
  bases: EventBase[];
  types: EventTypeMeta[];
  fields: CustomField[];
  fieldValues: Record<number, FieldValues>;
}

const toBackupFields = (fields: CustomField[], owner: CustomField['owner'], ownerId: number): BackupField[] =>
  fields
    .filter((f) => f.owner === owner && f.ownerId === ownerId)
    .sort((a, b) => a.position - b.position)
    .map(({ label, kind, options, required }) => ({ label, kind, options, required }));

/** Arma el contenido del backup a partir de lo que hay en la base. */
export function buildBackup(snapshot: BackupSnapshot, now: Date = new Date()): BackupFile {
  const fieldsById = new Map(snapshot.fields.map((f) => [f.id, f]));
  const refByEventId = new Map(snapshot.events.map((event, index) => [event.id, `e${index + 1}`]));

  const valuesFor = (eventId: number): Record<string, string> | undefined => {
    const entries = Object.entries(snapshot.fieldValues[eventId] ?? {}).flatMap(([id, value]) => {
      const field = fieldsById.get(Number(id));
      return field ? [[backupFieldKey(field), value] as const] : [];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  return {
    app: 'crono',
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    excludes: [...BACKUP_EXCLUDES],
    displayName: snapshot.displayName,
    // Se guardan sin los ids ni los ids de notificación: son de ESTE celular.
    // Las etiquetas viajan por nombre (se resuelven o crean solas al restaurar).
    // La foto NO viaja: es un archivo local (FileSystem.documentDirectory) que
    // no existe en el celular que restaura — restaurar sin foto es mejor que
    // guardar una ruta rota.
    events: snapshot.events.map(({ id, reminders, tags, photoUri: _photoUri, ...event }) => {
      const fieldValues = valuesFor(id);
      return {
        ...event,
        ref: refByEventId.get(id) ?? null,
        reminders: reminders.map(({ amount, unit }) => ({ amount, unit })),
        tags: tags.map((tag) => tag.name),
        photoUri: null,
        ...(fieldValues ? { fieldValues } : {}),
      };
    }),
    notes: snapshot.notes.map(({ title, content }) => ({ title, content })),
    // Un saludo apunta a su evento por `ref`. Si apunta a un evento que ya no existe es un huérfano (el borrado
    // debió llevárselo por cascada): no se exporta ni se reconvierte en invitado.
    greetings: snapshot.greetings.flatMap(({ year, eventId, name, phone, greeted }): BackupGreeting[] => {
      if (eventId === null) return [{ year, name, phone, greeted, eventRef: null }];
      const eventRef = refByEventId.get(eventId);
      return eventRef ? [{ year, name, phone, greeted, eventRef }] : [];
    }),
    greetingsSent: snapshot.greetingsSent.flatMap(({ year, eventId, greeted }): BackupGreetingSent[] => {
      const eventRef = refByEventId.get(eventId);
      return eventRef ? [{ year, eventRef, greeted }] : [];
    }),
    typeConfig: {
      bases: snapshot.bases
        .filter((b) => !b.isBuiltin)
        .map(({ id, key, label, yearly, requiresTime, capabilities }) => ({
          key, label, yearly, requiresTime, capabilities, fields: toBackupFields(snapshot.fields, 'base', id),
        })),
      types: snapshot.types
        .filter((t) => !t.isBuiltin)
        .map(({ id, key, label, icon, color, baseKey, extraCapabilities }) => ({
          key, label, icon, color, baseKey, extraCapabilities, fields: toBackupFields(snapshot.fields, 'type', id),
        })),
      // Los de fábrica ya existen en cualquier instalación: solo viaja cómo los personalizó el usuario.
      builtinTypes: snapshot.types.flatMap((t): BackupBuiltinType[] =>
        isBuiltinKey(t.key) && t.isBuiltin && !t.hidden
          ? [{ key: t.key, label: t.label, icon: t.icon, color: t.color }]
          : [],
      ),
    },
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Nombre del archivo: 'crono-backup-2026-07-12.json'. */
export function backupFileName(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `crono-backup-${iso}.json`;
}

/** Cuántos ítems del archivo no sirvieron (estaban corruptos) y se descartaron. */
export interface BackupDiscards {
  events: number;
  notes: number;
  greetings: number;
  greetingsSent: number;
  types: number;
}

export type ParseResult =
  | { ok: true; backup: BackupFile; discarded: BackupDiscards }
  | { ok: false; error: string };

/**
 * Lee y VALIDA un archivo de backup. Nunca confiamos en el contenido: puede
 * estar corrupto, ser otro archivo, o venir de una versión futura de la app.
 * Lo que se descarta se cuenta (`discarded`) para avisárselo al usuario.
 */
export function parseBackup(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'El archivo no es un backup válido de Crono.' };
  }

  if (!isRecord(data) || data.app !== 'crono') {
    return { ok: false, error: 'El archivo no es un backup de Crono.' };
  }

  const version = data.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < MIN_SUPPORTED_FORMAT_VERSION) {
    return { ok: false, error: 'El backup no declara una versión de formato válida.' };
  }
  if (version > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'El backup viene de una versión más nueva de Crono. Actualizá la app.' };
  }
  // Lo que agregó v2 no se interpreta en un archivo v1 (ver CONTRATO DE VERSIONES).
  const v2 = version >= 2;

  // Cada ítem se normaliza (no se confía en el archivo): los inválidos se descartan y se cuentan.
  const events = collect(data.events, (item) => toEvent(item, v2));
  const notes = collect(data.notes, toNote);
  const greetings = collect(data.greetings, (item) => toGreeting(item, v2));
  const greetingsSent = v2 ? collect(data.greetingsSent, toGreetingSent) : { items: [], dropped: 0 };
  const typeTally = { dropped: 0 };
  const typeConfig = toTypeConfig(data.typeConfig, v2, typeTally);

  // Un `ref` repetido haría ambiguo el vínculo: solo el primer evento lo conserva.
  const seenRefs = new Set<string>();
  const uniqueEvents = events.items.map((event) => {
    if (event.ref === null) return event;
    if (seenRefs.has(event.ref)) return { ...event, ref: null };
    seenRefs.add(event.ref);
    return event;
  });

  const discarded: BackupDiscards = {
    events: events.dropped,
    notes: notes.dropped,
    greetings: greetings.dropped,
    greetingsSent: greetingsSent.dropped,
    types: typeTally.dropped,
  };

  if (uniqueEvents.length === 0 && notes.items.length === 0 && greetings.items.length === 0 && greetingsSent.items.length === 0) {
    const total = Object.values(discarded).reduce((sum, n) => sum + n, 0);
    return {
      ok: false,
      error:
        total > 0
          ? `El backup no tiene datos válidos para restaurar (${total} elementos dañados).`
          : 'El backup no tiene eventos ni notas para restaurar.',
    };
  }

  return {
    ok: true,
    discarded,
    backup: {
      app: 'crono',
      formatVersion: version,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
      ...(v2 ? { excludes: [...BACKUP_EXCLUDES] } : {}),
      displayName: typeof data.displayName === 'string' ? data.displayName : null,
      events: uniqueEvents,
      notes: notes.items,
      greetings: greetings.items,
      ...(v2 ? { greetingsSent: greetingsSent.items } : {}),
      ...(typeConfig ? { typeConfig } : {}),
    },
  };
}

/** Convierte cada ítem de una lista del archivo y cuenta los que no sirvieron. */
function collect<T>(value: unknown, convert: (item: unknown) => T[]): { items: T[]; dropped: number } {
  if (!Array.isArray(value)) return { items: [], dropped: 0 };
  const items = value.flatMap(convert);
  return { items, dropped: value.length - items.length };
}

/** ¿Es la clave de uno de los 5 tipos de fábrica? */
export const isBuiltinKey = (key: string): key is BuiltinEventType => (EVENT_TYPES as readonly string[]).includes(key);

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const toCapabilities = (value: unknown): Capability[] =>
  isStringList(value) ? value.filter((c): c is Capability => (CAPABILITIES as readonly string[]).includes(c)) : [];

/**
 * Los backups anteriores a la obligatoriedad por campo no la traen: se toma lo
 * que hacían antes (los de una base, obligatorios; los de un tipo, opcionales).
 */
function toFields(value: unknown, requiredByDefault: boolean, tally: { dropped: number }): BackupField[] {
  if (!Array.isArray(value)) return [];
  const fields = value.flatMap((f): BackupField[] => {
    if (!isRecord(f) || typeof f.label !== 'string' || f.label.trim().length === 0) return [];
    if (typeof f.kind !== 'string' || !(FIELD_KINDS as readonly string[]).includes(f.kind)) return [];
    return [{
      label: f.label.trim(),
      kind: f.kind as FieldKind,
      options: isStringList(f.options) ? f.options : [],
      required: typeof f.required === 'boolean' ? f.required : requiredByDefault,
    }];
  });
  tally.dropped += value.length - fields.length;
  return fields;
}

/** Normaliza la configuración de tipos del archivo; lo inválido se descarta (y se cuenta). */
function toTypeConfig(value: unknown, v2: boolean, tally: { dropped: number }): BackupTypeConfig | undefined {
  if (!isRecord(value)) return undefined;
  const text = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);

  const rawBases = Array.isArray(value.bases) ? value.bases : [];
  const bases = rawBases.flatMap((b): BackupBase[] => {
    if (!isRecord(b)) return [];
    const key = text(b.key);
    const label = text(b.label);
    if (!key || !label) return [];
    return [{
      key, label, yearly: b.yearly === true, requiresTime: b.requiresTime === true,
      capabilities: toCapabilities(b.capabilities), fields: toFields(b.fields, true, tally),
    }];
  });
  const rawTypes = Array.isArray(value.types) ? value.types : [];
  const types = rawTypes.flatMap((t): BackupType[] => {
    if (!isRecord(t)) return [];
    const key = text(t.key);
    const label = text(t.label);
    const baseKey = text(t.baseKey);
    if (!key || !label || !baseKey) return [];
    return [{
      key, label, baseKey,
      icon: text(t.icon) ?? 'calendar',
      color: text(t.color) ?? '#208AEF',
      extraCapabilities: toCapabilities(t.extraCapabilities),
      fields: toFields(t.fields, false, tally),
    }];
  });
  tally.dropped += rawBases.length - bases.length + (rawTypes.length - types.length);

  const rawBuiltin = v2 && Array.isArray(value.builtinTypes) ? value.builtinTypes : [];
  const builtinTypes = rawBuiltin.flatMap((t): BackupBuiltinType[] => {
    if (!isRecord(t)) return [];
    const key = text(t.key);
    const label = text(t.label);
    const icon = text(t.icon);
    const color = text(t.color);
    if (!key || !isBuiltinKey(key) || !label || !icon || !color) return [];
    return [{ key, label, icon, color }];
  });
  tally.dropped += rawBuiltin.length - builtinTypes.length;

  if (bases.length === 0 && types.length === 0 && builtinTypes.length === 0) return undefined;
  return { bases, types, ...(v2 ? { builtinTypes } : {}) };
}

function toFieldValues(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Empareja cada ítem del archivo con uno que YA existe (o `null` si falta
 * agregarlo). Es un emparejamiento uno a uno: si el archivo trae dos ítems
 * iguales y la agenda tiene uno, el segundo se agrega. Así importar el mismo
 * archivo dos veces nunca agrega nada la segunda vez, ni siquiera con repetidos.
 */
export function matchExisting<T, E>(
  items: readonly T[],
  existing: readonly E[],
  keyOfItem: (item: T) => string,
  keyOfExisting: (existing: E) => string,
): (E | null)[] {
  const pool = new Map<string, E[]>();
  for (const entry of existing) {
    const key = keyOfExisting(entry);
    const list = pool.get(key);
    if (list) list.push(entry);
    else pool.set(key, [entry]);
  }
  return items.map((item) => pool.get(keyOfItem(item))?.shift() ?? null);
}

/**
 * Un evento es "el mismo" si coinciden título, tipo y fecha; una nota, si
 * coinciden título y contenido; un saludo, si coinciden año, nombre y teléfono.
 */
export function eventKey(event: Pick<EventItem, 'title' | 'type' | 'date'>): string {
  return `${event.title.trim().toLowerCase()}|${event.type}|${event.date}`;
}

export function noteKey(note: Pick<Note, 'title' | 'content'>): string {
  return `${note.title.trim().toLowerCase()}|${note.content.trim()}`;
}

export function greetingKey(greeting: Pick<Greeting, 'year' | 'name' | 'phone'>): string {
  return `${greeting.year}|${greeting.name.trim().toLowerCase()}|${(greeting.phone ?? '').trim()}`;
}

/** Qué eventos del archivo faltan en la agenda: `null` = ya está; si no, sin match. */
export function matchBackupEvents(
  events: readonly BackupEvent[],
  existing: readonly Pick<EventItem, 'id' | 'title' | 'type' | 'date'>[],
): (Pick<EventItem, 'id' | 'title' | 'type' | 'date'> | null)[] {
  return matchExisting(events, existing, eventKey, eventKey);
}

/** Resultado de una restauración (lo muestra la pantalla de Perfil). */
export interface RestoreSummary {
  /** Cuántos se agregaron. */
  events: number;
  notes: number;
  greetings: number;
  greetingsSent: number;
  /** Cuántos ya estaban y se saltearon (no se duplican). */
  skipped: number;
  /** Elementos dañados del archivo que no se pudieron leer. */
  discarded: number;
  /** Valores de campos del archivo que no tienen campo equivalente en este celular. */
  droppedFieldValues: number;
  /** Saludos y marcas cuyo evento no se pudo ubicar (los saludos quedan como invitados). */
  unlinkedGreetings: number;
  /** Eventos cuyo tipo no existe en este celular (se ven como "Otro"). */
  unknownTypeEvents: number;
  /** Tipos o campos que no se pudieron restaurar por falta de su base. */
  skippedTypes: number;
  /** Personalizaciones locales de tipos de fábrica que se conservaron en vez de pisarlas. */
  keptLocalTypes: number;
  /** El archivo traía otro "mi cumpleaños" y se conservó el de este celular. */
  ownBirthdayKept: boolean;
  displayNameRestored: boolean;
  sourceFormatVersion: number;
  /** La copia se escribió completa, pero no se pudo recargar alguna pantalla (reiniciar la app lo resuelve). */
  refreshFailed: boolean;
}

/** Lo que escribe la transacción de restauración (el resto lo completa el thunk). */
export type RestoreCounts = Omit<RestoreSummary, 'discarded' | 'refreshFailed'>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto para el usuario: qué se restauró y qué NO se pudo (nada se pierde en silencio). */
export function describeRestore(summary: RestoreSummary): { title: string; message: string } {
  const lines = [`Se restauraron ${plural(summary.events, 'evento', 'eventos')} y ${plural(summary.notes, 'nota', 'notas')}.`];
  const people = [
    ...(summary.greetings > 0 ? [plural(summary.greetings, 'saludo', 'saludos')] : []),
    ...(summary.greetingsSent > 0 ? [plural(summary.greetingsSent, 'marca de "ya lo saludé"', 'marcas de "ya lo saludé"')] : []),
  ];
  if (people.length > 0) lines.push(`También ${people.join(' y ')}.`);
  if (summary.skipped > 0) lines.push(`${summary.skipped} ya estaban en tu agenda.`);
  if (summary.displayNameRestored) lines.push('Se recuperó tu nombre.');

  const warnings: string[] = [];
  if (summary.discarded > 0) warnings.push(`${plural(summary.discarded, 'elemento dañado del archivo se descartó', 'elementos dañados del archivo se descartaron')}.`);
  if (summary.droppedFieldValues > 0) warnings.push(`${plural(summary.droppedFieldValues, 'valor de campo no se pudo restaurar', 'valores de campos no se pudieron restaurar')} (su campo no existe en este celular).`);
  if (summary.unlinkedGreetings > 0) warnings.push(`${plural(summary.unlinkedGreetings, 'saludo o marca quedó sin su evento', 'saludos o marcas quedaron sin su evento')}.`);
  if (summary.unknownTypeEvents > 0) warnings.push(`${plural(summary.unknownTypeEvents, 'evento tiene un tipo que no existe acá', 'eventos tienen un tipo que no existe acá')}; se ven como "Otro".`);
  if (summary.skippedTypes > 0) warnings.push(`${plural(summary.skippedTypes, 'tipo no se pudo restaurar', 'tipos no se pudieron restaurar')} porque falta su base.`);
  if (summary.keptLocalTypes > 0) warnings.push(`Se conservó la personalización que ya tenías en ${plural(summary.keptLocalTypes, 'tipo de fábrica', 'tipos de fábrica')}.`);
  if (summary.ownBirthdayKept) warnings.push('Solo un evento puede ser "mi cumpleaños": el del archivo que sobraba se agregó como un evento común.');
  if (summary.sourceFormatVersion < BACKUP_FORMAT_VERSION) warnings.push('Es una copia de un formato anterior: no incluye vínculos de saludos ni personalización de tipos de fábrica.');
  if (summary.refreshFailed) warnings.push('Se guardó todo, pero no se pudo actualizar alguna pantalla: cerrá y volvé a abrir Crono.');

  return { title: warnings.length > 0 ? 'Listo, con avisos' : 'Listo', message: [...lines, ...warnings].join('\n') };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Devuelve el evento normalizado, o [] si el ítem del archivo no sirve (para usar con flatMap). */
function toEvent(value: unknown, v2: boolean): BackupEvent[] {
  if (!isRecord(value)) return [];

  const { title, type, date, yearly } = value;

  const titleOk = typeof title === 'string' && title.trim().length > 0;
  // Los tipos personalizados no son un enum fijo: alcanza con que sea texto no
  // vacío. Si esa clave ya no existe al restaurar, se ve con el ícono/color
  // de reserva (FALLBACK_EVENT_TYPE_META) — no rompe la restauración.
  const typeOk = typeof type === 'string' && type.trim().length > 0;
  const dateOk = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const yearlyOk = yearly === 0 || yearly === 1;
  if (!titleOk || !typeOk || !dateOk || !yearlyOk) return [];

  return [
    {
      title: title.trim(),
      type: type as NewEvent['type'],
      date,
      yearly: yearly as 0 | 1,
      isMine: value.isMine === 1 ? 1 : 0,
      time: typeof value.time === 'string' ? value.time : null,
      description: typeof value.description === 'string' ? value.description : null,
      contactId: typeof value.contactId === 'string' ? value.contactId : null,
      phone: typeof value.phone === 'string' ? value.phone : null,
      reminders: toReminders(value.reminders),
      tags: toTagNames(value.tags),
      photoUri: null, // nunca se restaura: ver comentario en buildBackup
      // Las copias anteriores a "año desconocido" no traen el campo: se asume conocido.
      yearUnknown: value.yearUnknown === 1 ? 1 : 0,
      ref: v2 && typeof value.ref === 'string' && value.ref.trim().length > 0 ? value.ref.trim() : null,
      ...(toFieldValues(value.fieldValues) ? { fieldValues: toFieldValues(value.fieldValues) } : {}),
    },
  ];
}

function toTagNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((name): name is string => typeof name === 'string' && name.trim().length > 0);
}

function toReminders(value: unknown): ReminderInput[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((r): ReminderInput[] => {
    if (!isRecord(r)) return [];
    const { amount, unit } = r;
    const ok =
      typeof amount === 'number' &&
      Number.isInteger(amount) &&
      amount >= 0 &&
      typeof unit === 'string' &&
      (REMINDER_UNITS as readonly string[]).includes(unit);

    return ok ? [{ amount, unit: unit as ReminderInput['unit'] }] : [];
  });
}

function toNote(value: unknown): NewNote[] {
  if (!isRecord(value)) return [];
  const { title, content } = value;
  if (typeof title !== 'string' || typeof content !== 'string') return [];
  if (title.trim().length === 0 && content.trim().length === 0) return [];

  return [{ title, content }];
}

function isValidYear(year: unknown): year is number {
  return typeof year === 'number' && Number.isInteger(year) && year >= 0;
}

function toGreeting(value: unknown, v2: boolean): BackupGreeting[] {
  if (!isRecord(value)) return [];
  const { year, name, phone, greeted } = value;
  if (!isValidYear(year) || typeof name !== 'string' || name.trim().length === 0) return [];
  if (phone !== null && typeof phone !== 'string') return [];
  if (greeted !== 0 && greeted !== 1) return [];
  const eventRef = v2 && typeof value.eventRef === 'string' && value.eventRef.trim().length > 0 ? value.eventRef.trim() : null;
  return [{ year, name: name.trim(), phone, greeted, eventRef }];
}

function toGreetingSent(value: unknown): BackupGreetingSent[] {
  if (!isRecord(value)) return [];
  const { year, eventRef, greeted } = value;
  if (!isValidYear(year) || typeof eventRef !== 'string' || eventRef.trim().length === 0) return [];
  if (greeted !== 0 && greeted !== 1) return [];
  return [{ year, eventRef: eventRef.trim(), greeted }];
}
