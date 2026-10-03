import { getDb } from '@/db/database';
import { parseCapabilities, parseOptions } from '@/db/json-columns';
import { FIELD_KINDS, type CustomField, type EventBase, type FieldKind } from '@/types';

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
