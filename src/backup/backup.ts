import { CAPABILITIES, FIELD_KINDS, REMINDER_UNITS } from '@/types';
import type {
  Capability,
  CustomField,
  EventBase,
  EventItem,
  EventTypeMeta,
  FieldKind,
  FieldValues,
  Greeting,
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
 */

export const BACKUP_FORMAT_VERSION = 1;

/** Un saludo no conserva ids del dispositivo de origen. */
export type BackupGreeting = Omit<Greeting, 'id' | 'eventId'> & { eventId: null };

/** Un campo personalizado sin ids: se reconoce por su dueño y su nombre. */
export interface BackupField {
  label: string;
  kind: FieldKind;
  options: string[];
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

/** Bases y tipos PROPIOS (los de fábrica ya vienen en cualquier instalación). */
export interface BackupTypeConfig {
  bases: BackupBase[];
  types: BackupType[];
}

/**
 * Un evento del backup. Los valores de sus campos van por clave
 * 'base:Obra social' / 'type:Qué llevar', porque los ids son de ESTE celular.
 */
export type BackupEvent = NewEvent & { fieldValues?: Record<string, string> };

export interface BackupFile {
  app: 'crono';
  formatVersion: number;
  exportedAt: string;
  displayName: string | null;
  events: BackupEvent[];
  notes: NewNote[];
  /** Opcional para mantener compatibilidad con backups v1 ya exportados. */
  greetings?: BackupGreeting[];
  /** Opcional: los backups anteriores a los tipos componibles no lo traen. */
  typeConfig?: BackupTypeConfig;
}

/** Clave estable de un campo dentro de un evento: dueño + nombre. */
export function backupFieldKey(field: Pick<CustomField, 'owner' | 'label'>): string {
  return `${field.owner}:${field.label}`;
}

/** Lo que hace falta para exportar bases, tipos y valores de campos. */
export interface TypeConfigSnapshot {
  bases: EventBase[];
  types: EventTypeMeta[];
  fields: CustomField[];
  values: Record<number, FieldValues>;
}

const toBackupFields = (fields: CustomField[], owner: CustomField['owner'], ownerId: number): BackupField[] =>
  fields
    .filter((f) => f.owner === owner && f.ownerId === ownerId)
    .sort((a, b) => a.position - b.position)
    .map(({ label, kind, options }) => ({ label, kind, options }));

/** Arma el contenido del backup a partir de lo que hay en la app. */
export function buildBackup(
  events: EventItem[],
  notes: Note[],
  displayName: string | null,
  now: Date = new Date(),
  greetings?: Greeting[],
  config?: TypeConfigSnapshot,
): BackupFile {
  const fieldsById = new Map((config?.fields ?? []).map((f) => [f.id, f]));
  const valuesFor = (eventId: number): Record<string, string> | undefined => {
    const entries = Object.entries(config?.values[eventId] ?? {}).flatMap(([id, value]) => {
      const field = fieldsById.get(Number(id));
      return field ? [[backupFieldKey(field), value] as const] : [];
    });
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const backup: BackupFile = {
    app: 'crono',
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    displayName,
    // Se guardan sin los ids ni los ids de notificación: son de ESTE celular.
    // Las etiquetas viajan por nombre (se resuelven o crean solas al restaurar).
    // La foto NO viaja: es un archivo local (FileSystem.documentDirectory) que
    // no existe en el celular que restaura — restaurar sin foto es mejor que
    // guardar una ruta rota.
    events: events.map(({ id, reminders, tags, photoUri: _photoUri, ...event }) => {
      const fieldValues = valuesFor(id);
      return {
        ...event,
        reminders: reminders.map(({ amount, unit }) => ({ amount, unit })),
        tags: tags.map((tag) => tag.name),
        photoUri: null,
        ...(fieldValues ? { fieldValues } : {}),
      };
    }),
    notes: notes.map(({ title, content }) => ({ title, content })),
  };
  if (config) {
    backup.typeConfig = {
      bases: config.bases
        .filter((b) => !b.isBuiltin)
        .map(({ id, key, label, yearly, requiresTime, capabilities }) => ({
          key, label, yearly, requiresTime, capabilities, fields: toBackupFields(config.fields, 'base', id),
        })),
      types: config.types
        .filter((t) => !t.isBuiltin)
        .map(({ id, key, label, icon, color, baseKey, extraCapabilities }) => ({
          key, label, icon, color, baseKey, extraCapabilities, fields: toBackupFields(config.fields, 'type', id),
        })),
    };
  }
  if (greetings !== undefined) {
    // eventId es local a la SQLite origen; restaurarlo sería enlazar a un
    // evento arbitrario. Se recupera el saludo como invitado independiente.
    backup.greetings = greetings.map(({ year, name, phone, greeted }) => ({ year, eventId: null, name, phone, greeted }));
  }
  return backup;
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Nombre del archivo: 'crono-backup-2026-07-12.json'. */
export function backupFileName(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `crono-backup-${iso}.json`;
}

export type ParseResult = { ok: true; backup: BackupFile } | { ok: false; error: string };

/**
 * Lee y VALIDA un archivo de backup. Nunca confiamos en el contenido: puede
 * estar corrupto, ser otro archivo, o venir de una versión futura de la app.
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

  if (typeof data.formatVersion !== 'number' || data.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'El backup viene de una versión más nueva de Crono. Actualizá la app.' };
  }

  // Cada ítem se normaliza (no se confía en el archivo): los inválidos se descartan.
  const events = Array.isArray(data.events) ? data.events.flatMap(toEvent) : [];
  const notes = Array.isArray(data.notes) ? data.notes.flatMap(toNote) : [];
  const greetings = Array.isArray(data.greetings) ? data.greetings.flatMap(toGreeting) : [];
  const typeConfig = toTypeConfig(data.typeConfig);

  if (events.length === 0 && notes.length === 0 && greetings.length === 0) {
    return { ok: false, error: 'El backup no tiene eventos ni notas para restaurar.' };
  }

  return {
    ok: true,
    backup: {
      app: 'crono',
      formatVersion: data.formatVersion,
      exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '',
      displayName: typeof data.displayName === 'string' ? data.displayName : null,
      events,
      notes,
      greetings,
      ...(typeConfig ? { typeConfig } : {}),
    },
  };
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const toCapabilities = (value: unknown): Capability[] =>
  isStringList(value) ? value.filter((c): c is Capability => (CAPABILITIES as readonly string[]).includes(c)) : [];

function toFields(value: unknown): BackupField[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((f): BackupField[] => {
    if (!isRecord(f) || typeof f.label !== 'string' || f.label.trim().length === 0) return [];
    if (typeof f.kind !== 'string' || !(FIELD_KINDS as readonly string[]).includes(f.kind)) return [];
    return [{ label: f.label.trim(), kind: f.kind as FieldKind, options: isStringList(f.options) ? f.options : [] }];
  });
}

/** Normaliza la configuración de tipos del archivo; lo inválido se descarta. */
function toTypeConfig(value: unknown): BackupTypeConfig | undefined {
  if (!isRecord(value)) return undefined;
  const text = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);

  const bases = (Array.isArray(value.bases) ? value.bases : []).flatMap((b): BackupBase[] => {
    if (!isRecord(b)) return [];
    const key = text(b.key);
    const label = text(b.label);
    if (!key || !label) return [];
    return [{
      key, label, yearly: b.yearly === true, requiresTime: b.requiresTime === true,
      capabilities: toCapabilities(b.capabilities), fields: toFields(b.fields),
    }];
  });
  const types = (Array.isArray(value.types) ? value.types : []).flatMap((t): BackupType[] => {
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
      fields: toFields(t.fields),
    }];
  });
  return bases.length > 0 || types.length > 0 ? { bases, types } : undefined;
}

function toFieldValues(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * Qué hay que agregar al restaurar: lo que ya existe NO se duplica.
 * Un evento es "el mismo" si coinciden título, tipo y fecha; una nota, si
 * coinciden título y contenido.
 */
export function itemsToRestore(
  backup: BackupFile,
  existingEvents: EventItem[],
  existingNotes: Note[],
): { events: BackupEvent[]; notes: NewNote[] } {
  const eventKeys = new Set(existingEvents.map((e) => eventKey(e)));
  const noteKeys = new Set(existingNotes.map((n) => noteKey(n)));

  return {
    events: backup.events.filter((e) => !eventKeys.has(eventKey(e))),
    notes: backup.notes.filter((n) => !noteKeys.has(noteKey(n))),
  };
}

function eventKey(event: Pick<EventItem, 'title' | 'type' | 'date'>): string {
  return `${event.title.trim().toLowerCase()}|${event.type}|${event.date}`;
}

function noteKey(note: Pick<Note, 'title' | 'content'>): string {
  return `${note.title.trim().toLowerCase()}|${note.content.trim()}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Devuelve el evento normalizado, o [] si el ítem del archivo no sirve (para usar con flatMap). */
function toEvent(value: unknown): BackupEvent[] {
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

function toGreeting(value: unknown): BackupGreeting[] {
  if (!isRecord(value)) return [];
  const { year, name, phone, greeted } = value;
  if (typeof year !== 'number' || !Number.isInteger(year) || year < 0 || typeof name !== 'string' || name.trim().length === 0) return [];
  if (phone !== null && typeof phone !== 'string') return [];
  if (greeted !== 0 && greeted !== 1) return [];
  return [{ year, eventId: null, name: name.trim(), phone, greeted }];
}
