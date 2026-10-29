import {
  greetingKey,
  isBuiltinKey,
  matchBackupEvents,
  matchExisting,
  noteKey,
  type RestoreCounts,
  type BackupBuiltinType,
  type BackupEvent,
  type BackupField,
  type BackupFile,
  type BackupSnapshot,
} from '@/backup/backup';
import { DEFAULT_EVENT_TYPES } from '@/constants/event-types';
import { findAllFieldValues, writeFields, type FieldOwner } from '@/db/custom-fields-repo';
import { getDb } from '@/db/database';
import { findAllEventBases, findAllCustomFields } from '@/db/event-bases-repo';
import { withEventTransaction, type EventExecutor } from '@/db/event-transaction';
import { findAllEventTypes } from '@/db/event-types-repo';
import { findAllEvents, writeEvent } from '@/db/events-repo';
import { findAllGreetings } from '@/db/greetings-repo';
import { findAllGreetingsSent } from '@/db/greetings-sent-repo';
import { findAllNotes } from '@/db/notes-repo';
import { getSetting } from '@/db/settings-repo';
import { enforceMineBirthday, type EventReminder, type NewEvent } from '@/types';

/**
 * Lectura y restauración de la copia de seguridad directamente contra SQLite.
 *
 * 💡 Aprendizaje: el backup NO se arma desde Redux. Redux es una copia en
 * memoria y "perezosa" (los saludos, por ejemplo, solo se cargan al visitar
 * la pantalla y de un solo año): exportar desde ahí dejaba datos afuera. La
 * verdad vive en SQLite, así que se lee de ahí, dentro de UNA transacción de
 * lectura para que todas las tablas correspondan al mismo instante.
 *
 * La restauración es UNA sola transacción por la misma cola de escritura que
 * usa guardar un evento (`withEventTransaction`): o entra todo o no entra nada,
 * y nunca se superpone con otro guardado sobre la misma conexión.
 */

/** Lo que cambió entre planificar los avisos y escribir: se reintenta, no se mezcla. */
const AGENDA_CHANGED_MESSAGE =
  'La agenda cambió mientras se restauraba la copia (otro guardado en curso).';

/** Todo lo exportable, leído de SQLite en un instante consistente. */
export function readBackupSnapshot(): Promise<BackupSnapshot> {
  return withEventTransaction(getDb(), async (tx): Promise<BackupSnapshot> => {
    // Secuencial a propósito: una sola conexión, sin consultas intercaladas.
    const events = await findAllEvents(tx);
    const notes = await findAllNotes(tx);
    const displayName = (await getSetting('displayName', tx))?.trim() || null;
    const greetings = await findAllGreetings(tx);
    const greetingsSent = await findAllGreetingsSent(tx);
    const bases = await findAllEventBases(tx);
    const types = await findAllEventTypes(tx);
    const fields = await findAllCustomFields(tx);
    const fieldValues = await findAllFieldValues(tx);
    return { displayName, events, notes, greetings, greetingsSent, bases, types, fields, fieldValues };
  });
}

interface EventIdentity {
  id: number;
  title: string;
  type: string;
  date: string;
}

const readEventIdentities = (tx: Pick<EventExecutor, 'getAllAsync'>) =>
  tx.getAllAsync<EventIdentity>('SELECT id, title, type, date FROM events ORDER BY id');

/**
 * Posiciones (en `backup.events`) de los eventos que todavía no están en la
 * agenda. Hace falta ANTES de escribir: sus avisos se programan en el sistema
 * operativo primero, para persistir los ids de notificación junto al evento.
 */
export function findMissingEventIndexes(backup: BackupFile): Promise<number[]> {
  return withEventTransaction(getDb(), async (tx) => {
    const matches = matchBackupEvents(backup.events, await readEventIdentities(tx));
    return matches.flatMap((match, index) => (match === null ? [index] : []));
  });
}

/**
 * Restaura el backup en una única transacción. `scheduledReminders` trae, por
 * posición en `backup.events`, los avisos ya programados de cada evento que se
 * va a agregar. Si algo falla, SQLite revierte todo y el llamador cancela esos
 * avisos; los datos previos quedan intactos.
 */
export function applyBackupRestore(
  backup: BackupFile,
  scheduledReminders: ReadonlyMap<number, EventReminder[]>,
): Promise<RestoreCounts> {
  return withEventTransaction(getDb(), (tx) => restoreInto(tx, backup, scheduledReminders));
}

async function restoreInto(
  tx: EventExecutor,
  backup: BackupFile,
  scheduledReminders: ReadonlyMap<number, EventReminder[]>,
): Promise<RestoreCounts> {
  const counts: RestoreCounts = {
    events: 0, notes: 0, greetings: 0, greetingsSent: 0, skipped: 0,
    droppedFieldValues: 0, unlinkedGreetings: 0, unknownTypeEvents: 0, skippedTypes: 0,
    keptLocalTypes: 0, ownBirthdayKept: false, displayNameRestored: false,
    sourceFormatVersion: backup.formatVersion,
  };

  await restoreTypes(tx, backup, counts);

  const existingEvents = await readEventIdentities(tx);
  const matches = matchBackupEvents(backup.events, existingEvents);
  const toInsert = matches.flatMap((match, index) => (match === null ? [index] : []));
  if (toInsert.length !== scheduledReminders.size || toInsert.some((index) => !scheduledReminders.has(index))) {
    throw new Error(AGENDA_CHANGED_MESSAGE);
  }

  const refToEventId = new Map<string, number>();
  const typeKeys = new Set((await tx.getAllAsync<{ key: string }>('SELECT key FROM event_types')).map((t) => t.key));
  const fieldIdsByType = new Map<string, Map<string, number>>();
  let mineTaken = (await tx.getFirstAsync('SELECT 1 FROM events WHERE is_mine = 1')) !== null;

  for (const [index, event] of backup.events.entries()) {
    const match = matches[index];
    if (match) {
      counts.skipped += 1;
      if (event.ref) refToEventId.set(event.ref, match.id);
      continue;
    }

    const { ref, fieldValues, ...data } = event;
    let toWrite: Omit<BackupEvent, 'ref' | 'fieldValues'> = data;
    if (data.isMine === 1) {
      if (mineTaken) {
        // La agenda de este celular ya tiene "mi cumpleaños": no se le saca la marca.
        // El del archivo entra como un evento común (la marca es única, ver índice events_single_mine).
        toWrite = { ...data, isMine: 0 };
        counts.ownBirthdayKept = true;
      } else {
        mineTaken = true;
        toWrite = enforceMineBirthday(data as NewEvent);
      }
    }
    if (!typeKeys.has(toWrite.type)) counts.unknownTypeEvents += 1;

    const resolved = await resolveFieldValues(tx, fieldIdsByType, toWrite.type, fieldValues ?? {});
    counts.droppedFieldValues += resolved.dropped;
    const written = await writeEvent(
      tx,
      { ...toWrite, fieldValues: resolved.values } as NewEvent,
      scheduledReminders.get(index) ?? [],
      null,
    );
    counts.events += 1;
    if (ref) refToEventId.set(ref, written.id);
  }

  await restoreNotes(tx, backup, counts);
  await restoreGreetings(tx, backup, refToEventId, counts);
  await restoreGreetingsSent(tx, backup, refToEventId, counts);

  // El nombre solo se recupera si este celular todavía no tiene uno: nunca se pisa.
  const incomingName = backup.displayName?.trim();
  if (incomingName && !(await getSetting('displayName', tx))?.trim()) {
    await tx.runAsync(
      `INSERT INTO settings (key, value) VALUES ('displayName', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      incomingName,
    );
    counts.displayNameRestored = true;
  }

  return counts;
}

/**
 * Valores del archivo ('type:Qué llevar' → valor) traducidos a los ids de
 * campo de ESTE celular según el tipo del evento. Los que no encuentran su
 * campo se cuentan para avisar: no se pierden en silencio.
 */
async function resolveFieldValues(
  tx: EventExecutor,
  cache: Map<string, Map<string, number>>,
  typeKey: string,
  byKey: Record<string, string>,
): Promise<{ values: Record<number, string>; dropped: number }> {
  let ids = cache.get(typeKey);
  if (!ids) {
    const rows = await tx.getAllAsync<{ id: number; label: string; baseId: number | null }>(
      `SELECT f.id, f.label, f.base_id AS baseId FROM custom_fields f
       WHERE f.type_id = (SELECT id FROM event_types WHERE key = ?)
          OR f.base_id = (SELECT b.id FROM event_bases b JOIN event_types t ON t.base_key = b.key WHERE t.key = ?)`,
      typeKey, typeKey,
    );
    ids = new Map(rows.map((row) => [`${row.baseId !== null ? 'base' : 'type'}:${row.label}`, row.id]));
    cache.set(typeKey, ids);
  }
  const values: Record<number, string> = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(byKey)) {
    const id = ids.get(key);
    if (id === undefined) {
      // Un valor vacío no es dato: writeEventFieldValues también lo descarta.
      if (value.trim().length > 0 && value !== '[]') dropped += 1;
    } else {
      values[id] = value;
    }
  }
  return { values, dropped };
}

/**
 * Tipos de fábrica y propios. Lo que ya existe NO se pisa: un tipo con la misma
 * clave se conserva y solo se le suman los campos que le falten. La
 * personalización de un tipo de fábrica se aplica únicamente si acá sigue
 * como vino de fábrica.
 */
async function restoreTypes(tx: EventExecutor, backup: BackupFile, counts: RestoreCounts): Promise<void> {
  const config = backup.typeConfig;
  const customization = new Map<string, BackupBuiltinType>(
    (config?.builtinTypes ?? []).map((t) => [t.key, t]),
  );

  // Un tipo de fábrica que el usuario borró y que los eventos del archivo usan se vuelve a crear.
  const usedBuiltin = new Set(backup.events.map((e) => e.type).filter(isBuiltinKey));
  for (const key of new Set<string>([...usedBuiltin, ...customization.keys()])) {
    if (!isBuiltinKey(key)) continue;
    const factory = DEFAULT_EVENT_TYPES[key];
    const wanted = customization.get(key);
    const local = await tx.getFirstAsync<{ label: string; icon: string; color: string }>(
      'SELECT label, icon, color FROM event_types WHERE key = ? AND is_builtin = 1',
      key,
    );
    if (!local) {
      // Solo se recrea si algún evento lo necesita; una personalización suelta no resucita un tipo borrado.
      if (!usedBuiltin.has(key)) continue;
      const meta = wanted ?? factory;
      await tx.runAsync(
        'INSERT INTO event_types (key, label, icon, color, default_yearly, is_builtin, base_key, extra_capabilities) ' +
          "VALUES (?, ?, ?, ?, ?, 1, ?, '[]')",
        key, meta.label, meta.icon, meta.color, factory.defaultYearly ? 1 : 0, key,
      );
      continue;
    }
    if (!wanted || (wanted.label === local.label && wanted.icon === local.icon && wanted.color === local.color)) continue;
    if (local.label === factory.label && local.icon === factory.icon && local.color === factory.color) {
      await tx.runAsync(
        'UPDATE event_types SET label = ?, icon = ?, color = ? WHERE key = ? AND is_builtin = 1',
        wanted.label, wanted.icon, wanted.color, key,
      );
    } else {
      counts.keptLocalTypes += 1;
    }
  }

  for (const base of config?.bases ?? []) {
    const existing = await tx.getFirstAsync<{ id: number }>('SELECT id FROM event_bases WHERE key = ?', base.key);
    if (existing) {
      await addMissingFields(tx, { column: 'base_id', id: existing.id }, base.fields);
      continue;
    }
    const result = await tx.runAsync(
      'INSERT INTO event_bases (key, label, yearly, requires_time, capabilities, is_builtin) VALUES (?, ?, ?, ?, ?, 0)',
      base.key, base.label, base.yearly ? 1 : 0, base.requiresTime ? 1 : 0, JSON.stringify(base.capabilities),
    );
    await writeFields(tx, { column: 'base_id', id: result.lastInsertRowId }, base.fields);
  }

  for (const type of config?.types ?? []) {
    const existing = await tx.getFirstAsync<{ id: number }>('SELECT id FROM event_types WHERE key = ?', type.key);
    if (existing) {
      await addMissingFields(tx, { column: 'type_id', id: existing.id }, type.fields);
      continue;
    }
    const base = await tx.getFirstAsync<{ yearly: 0 | 1 }>('SELECT yearly FROM event_bases WHERE key = ?', type.baseKey);
    if (!base) {
      counts.skippedTypes += 1;
      continue;
    }
    const result = await tx.runAsync(
      'INSERT INTO event_types (key, label, icon, color, default_yearly, is_builtin, base_key, extra_capabilities) ' +
        'VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      type.key, type.label, type.icon, type.color, base.yearly, type.baseKey, JSON.stringify(type.extraCapabilities),
    );
    await writeFields(tx, { column: 'type_id', id: result.lastInsertRowId }, type.fields);
  }
}

/**
 * A un dueño que ya existe se le suman los campos que le falten (por nombre).
 * Entran como opcionales: no se le impone a los eventos que ya tiene un
 * campo obligatorio que nunca completaron.
 */
async function addMissingFields(tx: EventExecutor, owner: FieldOwner, fields: readonly BackupField[]): Promise<void> {
  const have = await tx.getAllAsync<{ label: string }>(`SELECT label FROM custom_fields WHERE ${owner.column} = ?`, owner.id);
  const known = new Set(have.map((f) => f.label.trim().toLowerCase()));
  const last = await tx.getFirstAsync<{ position: number }>(
    `SELECT COALESCE(MAX(position), -1) AS position FROM custom_fields WHERE ${owner.column} = ?`,
    owner.id,
  );
  let position = (last?.position ?? -1) + 1;
  for (const field of fields) {
    if (known.has(field.label.trim().toLowerCase())) continue;
    await tx.runAsync(
      `INSERT INTO custom_fields (${owner.column}, label, kind, options, position, required) VALUES (?, ?, ?, ?, ?, 0)`,
      owner.id, field.label, field.kind, JSON.stringify(field.options), position,
    );
    position += 1;
    known.add(field.label.trim().toLowerCase());
  }
}

async function restoreNotes(tx: EventExecutor, backup: BackupFile, counts: RestoreCounts): Promise<void> {
  const existing = await tx.getAllAsync<{ id: number; title: string; content: string }>(
    'SELECT id, title, content FROM notes ORDER BY id',
  );
  const matches = matchExisting(backup.notes, existing, noteKey, noteKey);
  const now = new Date().toISOString();
  for (const [index, note] of backup.notes.entries()) {
    if (matches[index]) {
      counts.skipped += 1;
      continue;
    }
    await tx.runAsync(
      'INSERT INTO notes (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
      note.title, note.content, now, now,
    );
    counts.notes += 1;
  }
}

interface GreetingRow {
  id: number;
  year: number;
  eventId: number | null;
  name: string;
  phone: string | null;
}

/**
 * Saludos recibidos de todos los años. Uno enlazado se engancha a su evento
 * (el restaurado o el que ya estaba); uno sin vínculo, o cuyo evento no se
 * pudo ubicar, queda como invitado. El mismo saludo (año + nombre + teléfono)
 * nunca se duplica, esté o no ya enlazado a un evento.
 */
async function restoreGreetings(
  tx: EventExecutor,
  backup: BackupFile,
  refToEventId: ReadonlyMap<string, number>,
  counts: RestoreCounts,
): Promise<void> {
  const existing = await tx.getAllAsync<GreetingRow>(
    'SELECT id, year, event_id AS eventId, name, phone FROM greetings ORDER BY id',
  );
  const byKey = new Map<string, GreetingRow[]>();
  const byEventYear = new Map<string, GreetingRow>();
  for (const row of existing) {
    const key = greetingKey(row);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
    if (row.eventId !== null) byEventYear.set(`${row.year}|${row.eventId}`, row);
  }
  // Filas ya emparejadas (o recién insertadas): cada una cuenta una sola vez.
  const used = new Set<number>();
  const take = (key: string, accept: (row: GreetingRow) => boolean) =>
    byKey.get(key)?.find((row) => !used.has(row.id) && accept(row));

  for (const greeting of backup.greetings ?? []) {
    let eventId: number | null = null;
    if (greeting.eventRef !== null) {
      eventId = refToEventId.get(greeting.eventRef) ?? null;
      if (eventId === null) counts.unlinkedGreetings += 1;
    }
    const key = greetingKey(greeting);

    if (eventId !== null) {
      const linked = byEventYear.get(`${greeting.year}|${eventId}`);
      if (linked) {
        used.add(linked.id);
        counts.skipped += 1;
        continue;
      }
      // Un invitado igual que ya estaba se engancha al evento en vez de duplicarse.
      const guest = take(key, (row) => row.eventId === null);
      if (guest) {
        await tx.runAsync('UPDATE greetings SET event_id = ? WHERE id = ?', eventId, guest.id);
        used.add(guest.id);
        byEventYear.set(`${greeting.year}|${eventId}`, { ...guest, eventId });
        counts.skipped += 1;
        continue;
      }
    } else {
      const same = take(key, () => true);
      if (same) {
        used.add(same.id);
        counts.skipped += 1;
        continue;
      }
    }

    const result = await tx.runAsync(
      'INSERT INTO greetings (year, event_id, name, phone, greeted) VALUES (?, ?, ?, ?, ?)',
      greeting.year, eventId, greeting.name, greeting.phone, greeting.greeted,
    );
    used.add(result.lastInsertRowId);
    if (eventId !== null) {
      byEventYear.set(`${greeting.year}|${eventId}`, {
        id: result.lastInsertRowId, year: greeting.year, eventId, name: greeting.name, phone: greeting.phone,
      });
    }
    counts.greetings += 1;
  }
}

async function restoreGreetingsSent(
  tx: EventExecutor,
  backup: BackupFile,
  refToEventId: ReadonlyMap<string, number>,
  counts: RestoreCounts,
): Promise<void> {
  const existing = await tx.getAllAsync<{ year: number; eventId: number }>(
    'SELECT year, event_id AS eventId FROM greetings_sent',
  );
  const present = new Set(existing.map((row) => `${row.year}|${row.eventId}`));

  for (const sent of backup.greetingsSent ?? []) {
    const eventId = refToEventId.get(sent.eventRef);
    if (eventId === undefined) {
      counts.unlinkedGreetings += 1;
      continue;
    }
    const key = `${sent.year}|${eventId}`;
    if (present.has(key)) {
      counts.skipped += 1;
      continue;
    }
    await tx.runAsync('INSERT INTO greetings_sent (year, event_id, greeted) VALUES (?, ?, ?)', sent.year, eventId, sent.greeted);
    present.add(key);
    counts.greetingsSent += 1;
  }
}
