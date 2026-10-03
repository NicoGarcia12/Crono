import type * as SQLite from 'expo-sqlite';

import { parseMultiValue } from '@/constants/event-bases';
import { getDb } from '@/db/database';
import type { Capability, FieldDraft, FieldValues, RemovalPlan } from '@/types';

/**
 * Campos personalizados (de una base o de un tipo), sus valores por evento y
 * la limpieza de datos cuando se quita una capacidad, un campo o una opción.
 *
 * 💡 Aprendizaje: todo lo que borra datos corre DENTRO de la transacción del
 * llamador (recibe `db`), así "guardar el tipo" y "borrar lo que ya no aplica"
 * se confirman o se revierten juntos.
 */

type Executor = Pick<SQLite.SQLiteDatabase, 'runAsync' | 'getAllAsync'>;

/** Dueño de un campo: columna y id. */
export type FieldOwner = { column: 'base_id' | 'type_id'; id: number };

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** Inserta los campos nuevos y actualiza los existentes (nombre, opciones y orden; la clase no cambia). */
export async function writeFields(db: Executor, owner: FieldOwner, drafts: readonly FieldDraft[]): Promise<void> {
  for (const [position, draft] of drafts.entries()) {
    const options = JSON.stringify(draft.options);
    if (draft.id === undefined) {
      await db.runAsync(
        `INSERT INTO custom_fields (${owner.column}, label, kind, options, position) VALUES (?, ?, ?, ?, ?)`,
        owner.id, draft.label.trim(), draft.kind, options, position,
      );
    } else {
      await db.runAsync(
        `UPDATE custom_fields SET label = ?, options = ?, position = ? WHERE id = ? AND ${owner.column} = ?`,
        draft.label.trim(), options, position, draft.id, owner.id,
      );
    }
  }
}

/** Datos que guarda cada capacidad (las que solo muestran algo, como la edad, no guardan nada). */
const CAPABILITY_DATA: Partial<Record<Capability, { label: string; eventIdsSql: (types: string) => string; removeSql: (types: string) => string }>> = {
  regalos: {
    label: 'ideas de regalo',
    eventIdsSql: (t) => `SELECT g.event_id AS eventId FROM gift_ideas g JOIN events e ON e.id = g.event_id WHERE e.type IN (${t})`,
    removeSql: (t) => `DELETE FROM gift_ideas WHERE event_id IN (SELECT id FROM events WHERE type IN (${t}))`,
  },
  saludado: {
    label: 'marcas de "¿ya lo saludé?"',
    eventIdsSql: (t) => `SELECT g.event_id AS eventId FROM greetings_sent g JOIN events e ON e.id = g.event_id WHERE e.type IN (${t})`,
    removeSql: (t) => `DELETE FROM greetings_sent WHERE event_id IN (SELECT id FROM events WHERE type IN (${t}))`,
  },
  whatsapp: {
    label: 'teléfonos',
    eventIdsSql: (t) => `SELECT id AS eventId FROM events WHERE phone IS NOT NULL AND type IN (${t})`,
    removeSql: (t) => `UPDATE events SET phone = NULL WHERE type IN (${t})`,
  },
};

export interface RemovalImpact {
  /** Eventos distintos que pierden algún dato. */
  events: number;
  /** Detalle para el aviso: "3 ideas de regalo", "2 valores de «Obra social»". */
  items: { label: string; count: number }[];
}

interface ValueRow {
  eventId: number;
  fieldId: number;
  value: string;
}

/** Valores afectados por opciones quitadas: los de un select con esa opción, o los multi que la incluyen. */
async function valuesWithRemovedOptions(
  db: Executor,
  plan: RemovalPlan,
): Promise<{ row: ValueRow; kind: string; kept: string[] }[]> {
  const result: { row: ValueRow; kind: string; kept: string[] }[] = [];
  for (const { fieldId, removed } of plan.options) {
    const rows = await db.getAllAsync<ValueRow & { kind: string }>(
      `SELECT v.event_id AS eventId, v.field_id AS fieldId, v.value, f.kind
       FROM event_field_values v JOIN custom_fields f ON f.id = v.field_id WHERE v.field_id = ?`,
      fieldId,
    );
    for (const row of rows) {
      if (row.kind === 'multi') {
        const values = parseMultiValue(row.value);
        if (values.some((v) => removed.includes(v))) {
          result.push({ row, kind: row.kind, kept: values.filter((v) => !removed.includes(v)) });
        }
      } else if (removed.includes(row.value)) {
        result.push({ row, kind: row.kind, kept: [] });
      }
    }
  }
  return result;
}

/** Cuenta qué se perdería con el plan, para avisar antes de confirmar. No modifica nada. */
export async function countRemovalImpact(
  typeKeys: readonly string[],
  plan: RemovalPlan,
  fieldLabels: Readonly<Record<number, string>>,
): Promise<RemovalImpact> {
  const db = getDb();
  const events = new Set<number>();
  const items: RemovalImpact['items'] = [];

  if (typeKeys.length > 0) {
    for (const capability of plan.capabilities) {
      const data = CAPABILITY_DATA[capability];
      if (!data) continue;
      const rows = await db.getAllAsync<{ eventId: number }>(data.eventIdsSql(placeholders(typeKeys.length)), ...typeKeys);
      rows.forEach((r) => events.add(r.eventId));
      if (rows.length > 0) items.push({ label: data.label, count: rows.length });
    }
  }

  for (const fieldId of plan.fieldIds) {
    const rows = await db.getAllAsync<{ eventId: number }>(
      'SELECT event_id AS eventId FROM event_field_values WHERE field_id = ?',
      fieldId,
    );
    rows.forEach((r) => events.add(r.eventId));
    if (rows.length > 0) items.push({ label: `valores de «${fieldLabels[fieldId] ?? 'campo'}»`, count: rows.length });
  }

  const optionRows = await valuesWithRemovedOptions(db, plan);
  optionRows.forEach(({ row }) => events.add(row.eventId));
  if (optionRows.length > 0) items.push({ label: 'valores con opciones quitadas', count: optionRows.length });

  return { events: events.size, items };
}

/** Borra los datos que el plan deja sin lugar. Se llama dentro de una transacción. */
export async function applyRemovals(db: Executor, typeKeys: readonly string[], plan: RemovalPlan): Promise<void> {
  if (typeKeys.length > 0) {
    for (const capability of plan.capabilities) {
      const data = CAPABILITY_DATA[capability];
      if (data) await db.runAsync(data.removeSql(placeholders(typeKeys.length)), ...typeKeys);
    }
  }

  for (const { row, kind, kept } of await valuesWithRemovedOptions(db, plan)) {
    if (kind === 'multi' && kept.length > 0) {
      await db.runAsync(
        'UPDATE event_field_values SET value = ? WHERE event_id = ? AND field_id = ?',
        JSON.stringify(kept), row.eventId, row.fieldId,
      );
    } else {
      await db.runAsync('DELETE FROM event_field_values WHERE event_id = ? AND field_id = ?', row.eventId, row.fieldId);
    }
  }

  if (plan.fieldIds.length > 0) {
    // Los valores se borran explícitamente además del ON DELETE CASCADE, por si
    // la conexión no tuviera las foreign keys activas.
    const ids = placeholders(plan.fieldIds.length);
    await db.runAsync(`DELETE FROM event_field_values WHERE field_id IN (${ids})`, ...plan.fieldIds);
    await db.runAsync(`DELETE FROM custom_fields WHERE id IN (${ids})`, ...plan.fieldIds);
  }
}

/** Todos los valores de campos, agrupados por evento. */
export async function findAllFieldValues(): Promise<Record<number, FieldValues>> {
  const rows = await getDb().getAllAsync<ValueRow>(
    'SELECT event_id AS eventId, field_id AS fieldId, value FROM event_field_values',
  );
  const byEvent: Record<number, FieldValues> = {};
  for (const row of rows) {
    byEvent[row.eventId] = { ...byEvent[row.eventId], [row.fieldId]: row.value };
  }
  return byEvent;
}

/** Reemplaza los valores de un evento (los vacíos no se guardan). */
export async function saveEventFieldValues(eventId: number, values: FieldValues): Promise<FieldValues> {
  const db = getDb();
  const kept: FieldValues = {};
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM event_field_values WHERE event_id = ?', eventId);
    for (const [fieldId, value] of Object.entries(values)) {
      if (value.trim().length === 0 || value === '[]') continue;
      await db.runAsync(
        'INSERT INTO event_field_values (event_id, field_id, value) VALUES (?, ?, ?)',
        eventId, Number(fieldId), value,
      );
      kept[Number(fieldId)] = value;
    }
  });
  return kept;
}
