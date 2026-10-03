import { getDb } from '@/db/database';
import {
  createEventType,
  deleteEventTypeMovingEvents,
  deleteEventTypeWithEvents,
  ensureBuiltinType,
  updateEventType,
} from '@/db/event-types-repo';
import type { NewEventType, RemovalPlan } from '@/types';

jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

/** Fake mínimo de SQLite: registra cada sentencia y responde lo que el repo consulta. */
function fakeDb() {
  const keys = new Set(['cumpleanos']);
  const types: Record<number, { key: string; isBuiltin: 0 | 1 }> = {
    1: { key: 'cumpleanos', isBuiltin: 1 },
    7: { key: 'torneo', isBuiltin: 0 },
  };
  const statements: { sql: string; params: unknown[] }[] = [];
  let nextId = 10;

  return {
    statements,
    keys,
    async withTransactionAsync(task: () => Promise<void>) {
      await task();
    },
    async getFirstAsync(sql: string, param: string | number) {
      if (sql.startsWith('SELECT 1 FROM event_types WHERE key')) return keys.has(param as string) ? { 1: 1 } : null;
      if (sql.startsWith('SELECT yearly FROM event_bases')) return { yearly: param === 'festivo' ? 1 : 0 };
      if (sql.startsWith('SELECT key, is_builtin')) return types[param as number] ?? null;
      throw new Error(`SQL inesperado: ${sql}`);
    },
    async getAllAsync() {
      return [];
    },
    async runAsync(sql: string, ...params: unknown[]) {
      statements.push({ sql, params });
      return { lastInsertRowId: sql.startsWith('INSERT INTO event_types') ? nextId++ : 0, changes: 1 };
    },
  };
}

const data = (over: Partial<NewEventType> = {}): NewEventType => ({
  label: 'Torneo',
  icon: 'star',
  color: '#000',
  baseKey: 'evento',
  extraCapabilities: [],
  fields: [],
  ...over,
});

const emptyPlan: RemovalPlan = { capabilities: [], fieldIds: [], options: [] };

describe('createEventType', () => {
  it('arma la clave a partir del label: minúsculas, sin tildes, espacios a "_"', async () => {
    jest.mocked(getDb).mockReturnValue(fakeDb() as never);

    const result = await createEventType(data({ label: 'Día de Campo' }));

    expect(result.key).toBe('dia_de_campo');
    expect(result.isBuiltin).toBe(false);
  });

  it('si la clave ya existe, agrega un sufijo numérico', async () => {
    const db = fakeDb();
    db.keys.add('torneo');
    jest.mocked(getDb).mockReturnValue(db as never);

    expect((await createEventType(data())).key).toBe('torneo_2');
  });

  it('guarda la base, los extras y los campos, y copia la repetición de la base', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    const result = await createEventType(
      data({
        label: 'Día del Padre',
        baseKey: 'festivo',
        extraCapabilities: ['regalos'],
        fields: [{ label: 'Qué llevar', kind: 'multi', options: ['Asado', 'Vino'] }],
      }),
    );

    expect(result).toMatchObject({ baseKey: 'festivo', extraCapabilities: ['regalos'], defaultYearly: true });
    const field = db.statements.find((s) => s.sql.startsWith('INSERT INTO custom_fields (type_id'));
    expect(field?.params).toEqual([10, 'Qué llevar', 'multi', '["Asado","Vino"]', 0]);
  });
});

describe('updateEventType', () => {
  it('en un tipo de fábrica solo cambia label/ícono/color: nunca extras ni campos', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    await updateEventType(1, data({ label: 'Cumple', extraCapabilities: ['regalos'], fields: [{ label: 'X', kind: 'texto', options: [] }] }), emptyPlan);

    expect(db.statements).toHaveLength(1);
    expect(db.statements[0].sql).toMatch(/^UPDATE event_types SET label = \?, icon = \?, color = \? WHERE id = \?$/);
  });

  it('en un tipo propio borra los datos del plan y guarda los campos, todo en la transacción', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    await updateEventType(7, data({ extraCapabilities: [] }), { capabilities: ['regalos'], fieldIds: [3], options: [] });

    const sqls = db.statements.map((s) => s.sql);
    expect(sqls[0]).toMatch(/^UPDATE event_types SET label = \?, icon = \?, color = \?, extra_capabilities/);
    expect(sqls).toContainEqual(expect.stringMatching(/^DELETE FROM gift_ideas WHERE event_id IN/));
    expect(sqls).toContainEqual('DELETE FROM custom_fields WHERE id IN (?)');
    const giftDelete = db.statements.find((s) => s.sql.startsWith('DELETE FROM gift_ideas'));
    expect(giftDelete?.params).toEqual(['torneo']);
  });
});

describe('borrar un tipo', () => {
  it('moviendo: primero limpia lo que el destino no admite, después mueve y recién ahí borra', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    await deleteEventTypeMovingEvents(7, 'torneo', 'evento', { capabilities: ['regalos'], fieldIds: [], options: [] });

    const sqls = db.statements.map((s) => s.sql);
    const gift = sqls.findIndex((s) => s.startsWith('DELETE FROM gift_ideas'));
    const move = sqls.indexOf('UPDATE events SET type = ? WHERE type = ?');
    const remove = sqls.indexOf('DELETE FROM event_types WHERE id = ?');
    expect(gift).toBeGreaterThanOrEqual(0);
    expect(gift).toBeLessThan(move);
    expect(move).toBeLessThan(remove);
    expect(db.statements[move].params).toEqual(['evento', 'torneo']);
  });

  it('sin mover: borra los eventos del tipo y el tipo', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    await deleteEventTypeWithEvents(7, 'torneo');

    expect(db.statements[0]).toEqual({ sql: 'DELETE FROM events WHERE type = ?', params: ['torneo'] });
    expect(db.statements.at(-1)).toEqual({ sql: 'DELETE FROM event_types WHERE id = ?', params: [7] });
  });

  it('un tipo de fábrica borrado se vuelve a crear con su base cuando hace falta', async () => {
    const db = fakeDb();
    db.keys.delete('cumpleanos');
    jest.mocked(getDb).mockReturnValue(db as never);

    expect(await ensureBuiltinType('cumpleanos')).toBe(true);
    expect(db.statements[0].params).toEqual(['cumpleanos', 'Cumpleaños', 'gift', '#E91E63', 1, 'cumpleanos']);

    db.keys.add('cumpleanos');
    expect(await ensureBuiltinType('cumpleanos')).toBe(false);
  });
});
