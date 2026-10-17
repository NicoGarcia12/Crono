import { applyRemovals, writeFields } from '@/db/custom-fields-repo';
import { getDb } from '@/db/database';
import { parseCapabilities } from '@/db/json-columns';
import type { EventTypeMeta, NewEventType, RemovalPlan } from '@/types';

/**
 * Tipos de evento: los 5 de fábrica (sembrados por la migración v11) más los
 * que el usuario cree desde Perfil. `key` es la clave estable que guardan los
 * eventos (`events.type`); nunca se expone para editar.
 */

interface EventTypeRow {
  id: number;
  key: string;
  label: string;
  icon: string;
  color: string;
  defaultYearly: 0 | 1;
  isBuiltin: 0 | 1;
  baseKey: string;
  extraCapabilities: string;
}

const SELECT_FIELDS =
  'id, key, label, icon, color, default_yearly AS defaultYearly, is_builtin AS isBuiltin, ' +
  'base_key AS baseKey, extra_capabilities AS extraCapabilities';

function toMeta(row: EventTypeRow): EventTypeMeta {
  return {
    ...row,
    defaultYearly: row.defaultYearly === 1,
    isBuiltin: row.isBuiltin === 1,
    extraCapabilities: parseCapabilities(row.extraCapabilities),
  };
}

export async function findAllEventTypes(): Promise<EventTypeMeta[]> {
  const rows = await getDb().getAllAsync<EventTypeRow>(
    `SELECT ${SELECT_FIELDS} FROM event_types ORDER BY is_builtin DESC, id ASC`,
  );
  return rows.map(toMeta);
}

/** Clave estable a partir del label: minúsculas, sin tildes, espacios a "_". */
function slugify(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // saca tildes ya separadas por normalize
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base.length > 0 ? base : `tipo_${Date.now()}`;
}

/** Agrega "_2", "_3"... hasta que la clave no choque con una existente. */
async function uniqueKey(label: string): Promise<string> {
  const base = slugify(label);
  let key = base;
  let suffix = 2;
  while (await getDb().getFirstAsync('SELECT 1 FROM event_types WHERE key = ?', key)) {
    key = `${base}_${suffix}`;
    suffix += 1;
  }
  return key;
}

/** Crea el tipo con su base, sus extras y sus campos extra, todo junto o nada. */
export async function createEventType(data: NewEventType): Promise<EventTypeMeta> {
  const key = await uniqueKey(data.label);
  const db = getDb();
  let id = 0;
  let defaultYearly = false;
  await db.withTransactionAsync(async () => {
    // `default_yearly` queda como copia de la repetición de la base (columna histórica).
    const base = await db.getFirstAsync<{ yearly: 0 | 1 }>('SELECT yearly FROM event_bases WHERE key = ?', data.baseKey);
    defaultYearly = base?.yearly === 1;
    const result = await db.runAsync(
      'INSERT INTO event_types (key, label, icon, color, default_yearly, is_builtin, base_key, extra_capabilities) ' +
        'VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
      key, data.label.trim(), data.icon, data.color, defaultYearly ? 1 : 0,
      data.baseKey, JSON.stringify(data.extraCapabilities),
    );
    id = result.lastInsertRowId;
    await writeFields(db, { column: 'type_id', id }, data.fields);
  });
  return {
    id,
    key,
    label: data.label.trim(),
    icon: data.icon,
    color: data.color,
    defaultYearly,
    isBuiltin: false,
    baseKey: data.baseKey,
    extraCapabilities: data.extraCapabilities,
  };
}

/**
 * Guarda los cambios del tipo y borra, en la misma transacción, los datos que
 * el plan deja sin lugar (lo que el usuario ya confirmó en el aviso). En los de
 * fábrica solo cambian label/ícono/color: la clave, la base y los extras nunca.
 */
export async function updateEventType(id: number, data: NewEventType, plan: RemovalPlan): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ key: string; isBuiltin: 0 | 1 }>(
      'SELECT key, is_builtin AS isBuiltin FROM event_types WHERE id = ?',
      id,
    );
    if (!row) return;
    if (row.isBuiltin === 1) {
      await db.runAsync('UPDATE event_types SET label = ?, icon = ?, color = ? WHERE id = ?', data.label.trim(), data.icon, data.color, id);
      return;
    }
    await db.runAsync(
      'UPDATE event_types SET label = ?, icon = ?, color = ?, extra_capabilities = ? WHERE id = ?',
      data.label.trim(), data.icon, data.color, JSON.stringify(data.extraCapabilities), id,
    );
    await applyRemovals(db, [row.key], plan);
    await writeFields(db, { column: 'type_id', id }, data.fields);
  });
}

/** El repo confía en que la UI ya validó que no sea de fábrica y no esté en uso; acá solo borra. */
export async function deleteEventType(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM event_types WHERE id = ?', id);
}
