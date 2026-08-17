import { getDb } from '@/db/database';
import type { EventTypeMeta, NewEventType } from '@/types';

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
}

const SELECT_FIELDS =
  'id, key, label, icon, color, default_yearly AS defaultYearly, is_builtin AS isBuiltin';

function toMeta(row: EventTypeRow): EventTypeMeta {
  return { ...row, defaultYearly: row.defaultYearly === 1, isBuiltin: row.isBuiltin === 1 };
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

export async function createEventType(data: NewEventType): Promise<EventTypeMeta> {
  const key = await uniqueKey(data.label);
  const db = getDb();
  const result = await db.runAsync(
    'INSERT INTO event_types (key, label, icon, color, default_yearly, is_builtin) VALUES (?, ?, ?, ?, ?, 0)',
    key, data.label.trim(), data.icon, data.color, data.defaultYearly ? 1 : 0,
  );
  return {
    id: result.lastInsertRowId,
    key,
    label: data.label.trim(),
    icon: data.icon,
    color: data.color,
    defaultYearly: data.defaultYearly,
    isBuiltin: false,
  };
}

/** Solo label/ícono/color/repetición — la clave y si es de fábrica nunca cambian. */
export async function updateEventType(id: number, data: NewEventType): Promise<void> {
  await getDb().runAsync(
    'UPDATE event_types SET label = ?, icon = ?, color = ?, default_yearly = ? WHERE id = ?',
    data.label.trim(), data.icon, data.color, data.defaultYearly ? 1 : 0, id,
  );
}

/** El repo confía en que la UI ya validó que no sea de fábrica y no esté en uso; acá solo borra. */
export async function deleteEventType(id: number): Promise<void> {
  await getDb().runAsync('DELETE FROM event_types WHERE id = ?', id);
}
