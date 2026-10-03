import { writeFields, applyRemovals } from '@/db/custom-fields-repo';
import { getDb } from '@/db/database';
import { parseCapabilities, parseOptions } from '@/db/json-columns';
import {
  FIELD_KINDS,
  type CustomField,
  type EventBase,
  type FieldKind,
  type NewEventBase,
  type RemovalPlan,
} from '@/types';

/**
 * Bases de tipos de evento (las 5 de fábrica, sembradas por la migración v12)
 * y campos personalizados, tanto los obligatorios de una base como los
 * extras de un tipo.
 */

interface EventBaseRow {
  id: number;
  key: string;
  label: string;
  yearly: 0 | 1;
  requiresTime: 0 | 1;
  capabilities: string;
  isBuiltin: 0 | 1;
}

export async function findAllEventBases(): Promise<EventBase[]> {
  const rows = await getDb().getAllAsync<EventBaseRow>(
    'SELECT id, key, label, yearly, requires_time AS requiresTime, capabilities, is_builtin AS isBuiltin ' +
      'FROM event_bases ORDER BY is_builtin DESC, id ASC',
  );
  return rows.map((row) => ({
    ...row,
    yearly: row.yearly === 1,
    requiresTime: row.requiresTime === 1,
    capabilities: parseCapabilities(row.capabilities),
    isBuiltin: row.isBuiltin === 1,
  }));
}

/** Clave estable para una base propia: 'base_' + slug del nombre, sin chocar con las existentes. */
async function uniqueBaseKey(label: string): Promise<string> {
  const slug = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const base = `base_${slug || Date.now()}`;
  let key = base;
  let suffix = 2;
  while (await getDb().getFirstAsync('SELECT 1 FROM event_bases WHERE key = ?', key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
}

/** Crea una base propia con sus campos obligatorios, todo junto o nada. */
export async function createEventBase(data: NewEventBase): Promise<EventBase> {
  const key = await uniqueBaseKey(data.label);
  const db = getDb();
  let id = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO event_bases (key, label, yearly, requires_time, capabilities, is_builtin) VALUES (?, ?, ?, ?, ?, 0)',
      key, data.label.trim(), data.yearly ? 1 : 0, data.requiresTime ? 1 : 0, JSON.stringify(data.capabilities),
    );
    id = result.lastInsertRowId;
    await writeFields(db, { column: 'base_id', id }, data.fields);
  });
  return {
    id,
    key,
    label: data.label.trim(),
    yearly: data.yearly,
    requiresTime: data.requiresTime,
    capabilities: data.capabilities,
    isBuiltin: false,
  };
}

/**
 * Guarda nombre, capacidades y campos de una base propia, y borra en la misma
 * transacción los datos que el plan deja sin lugar en los eventos de todos los
 * tipos que salen de ella. La repetición y la hora obligatoria no cambian
 * después de crearla. Las de fábrica no se editan.
 */
export async function updateEventBase(id: number, data: NewEventBase, plan: RemovalPlan): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ key: string; isBuiltin: 0 | 1 }>(
      'SELECT key, is_builtin AS isBuiltin FROM event_bases WHERE id = ?',
      id,
    );
    if (!row || row.isBuiltin === 1) return;
    await db.runAsync(
      'UPDATE event_bases SET label = ?, capabilities = ? WHERE id = ?',
      data.label.trim(), JSON.stringify(data.capabilities), id,
    );
    const types = await db.getAllAsync<{ key: string }>('SELECT key FROM event_types WHERE base_key = ?', row.key);
    await applyRemovals(db, types.map((t) => t.key), plan);
    await writeFields(db, { column: 'base_id', id }, data.fields);
  });
}

/** Borra una base propia sin tipos (sus campos y valores caen con ella). La UI ya validó que no se use. */
export async function deleteEventBase(id: number): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM event_field_values WHERE field_id IN (SELECT id FROM custom_fields WHERE base_id = ?)', id);
    await db.runAsync('DELETE FROM custom_fields WHERE base_id = ?', id);
    await db.runAsync('DELETE FROM event_bases WHERE id = ? AND is_builtin = 0', id);
  });
}

interface CustomFieldRow {
  id: number;
  baseId: number | null;
  typeId: number | null;
  label: string;
  kind: string;
  options: string;
  position: number;
}

export async function findAllCustomFields(): Promise<CustomField[]> {
  const rows = await getDb().getAllAsync<CustomFieldRow>(
    'SELECT id, base_id AS baseId, type_id AS typeId, label, kind, options, position ' +
      'FROM custom_fields ORDER BY position ASC, id ASC',
  );
  return rows
    // Una clase desconocida (dato corrupto o de una versión futura) se omite en vez de romper.
    .filter((row) => (FIELD_KINDS as readonly string[]).includes(row.kind))
    .map((row) => ({
      id: row.id,
      owner: row.baseId !== null ? ('base' as const) : ('type' as const),
      ownerId: (row.baseId ?? row.typeId) as number,
      label: row.label,
      kind: row.kind as FieldKind,
      options: parseOptions(row.options),
      position: row.position,
    }));
}
