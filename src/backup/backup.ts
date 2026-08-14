import { EVENT_TYPES, REMINDER_UNITS } from '@/types';
import type { EventItem, NewEvent, NewNote, Note, ReminderInput } from '@/types';

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

export interface BackupFile {
  app: 'crono';
  formatVersion: number;
  exportedAt: string;
  displayName: string | null;
  events: NewEvent[];
  notes: NewNote[];
}

/** Arma el contenido del backup a partir de lo que hay en la app. */
export function buildBackup(
  events: EventItem[],
  notes: Note[],
  displayName: string | null,
  now: Date = new Date(),
): BackupFile {
  return {
    app: 'crono',
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: now.toISOString(),
    displayName,
    // Se guardan sin los ids ni los ids de notificación: son de ESTE celular.
    events: events.map(({ id: _id, reminders, ...event }) => ({
      ...event,
      reminders: reminders.map(({ amount, unit }) => ({ amount, unit })),
    })),
    notes: notes.map(({ title, content }) => ({ title, content })),
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

  if (events.length === 0 && notes.length === 0) {
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
    },
  };
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
): { events: NewEvent[]; notes: NewNote[] } {
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
function toEvent(value: unknown): NewEvent[] {
  if (!isRecord(value)) return [];

  const { title, type, date, yearly } = value;

  const titleOk = typeof title === 'string' && title.trim().length > 0;
  const typeOk = typeof type === 'string' && (EVENT_TYPES as readonly string[]).includes(type);
  const dateOk = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const yearlyOk = yearly === 0 || yearly === 1;
  if (!titleOk || !typeOk || !dateOk || !yearlyOk) return [];

  return [
    {
      title: title.trim(),
      type: type as NewEvent['type'],
      date,
      yearly: yearly as 0 | 1,
      time: typeof value.time === 'string' ? value.time : null,
      description: typeof value.description === 'string' ? value.description : null,
      contactId: typeof value.contactId === 'string' ? value.contactId : null,
      phone: typeof value.phone === 'string' ? value.phone : null,
      reminders: toReminders(value.reminders),
    },
  ];
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
