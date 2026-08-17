import { getDb } from '@/db/database';
import { createEventType, updateEventType } from '@/db/event-types-repo';

jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

/** Fake mínimo de SQLite: una tabla `event_types` en memoria. */
function fakeDb() {
  const rows: { id: number; key: string }[] = [{ id: 1, key: 'cumpleanos' }];
  let nextId = 2;
  const updates: unknown[][] = [];

  return {
    rows,
    updates,
    async getFirstAsync(sql: string, key: string) {
      if (sql.startsWith('SELECT 1 FROM event_types WHERE key')) {
        return rows.some((r) => r.key === key) ? { 1: 1 } : null;
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      if (sql.startsWith('INSERT INTO event_types')) {
        const id = nextId++;
        rows.push({ id, key: params[0] as string });
        return { lastInsertRowId: id, changes: 1 };
      }
      if (sql.startsWith('UPDATE event_types')) {
        updates.push(params);
        return { lastInsertRowId: 0, changes: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
}

describe('createEventType', () => {
  it('arma la clave a partir del label: minúsculas, sin tildes, espacios a "_"', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    const result = await createEventType({ label: 'Día de Campo', icon: 'sunny', color: '#000', defaultYearly: false });

    expect(result.key).toBe('dia_de_campo');
    expect(result.isBuiltin).toBe(false);
  });

  it('si la clave ya existe, agrega un sufijo numérico', async () => {
    const db = fakeDb();
    db.rows.push({ id: 5, key: 'torneo' });
    jest.mocked(getDb).mockReturnValue(db as never);

    const result = await createEventType({ label: 'Torneo', icon: 'star', color: '#000', defaultYearly: false });

    expect(result.key).toBe('torneo_2');
  });
});

describe('updateEventType', () => {
  it('solo actualiza label/ícono/color/repetición — nunca la clave', async () => {
    const db = fakeDb();
    jest.mocked(getDb).mockReturnValue(db as never);

    await updateEventType(1, { label: 'Cumpleaños', icon: 'gift', color: '#E91E63', defaultYearly: true });

    expect(db.updates).toEqual([['Cumpleaños', 'gift', '#E91E63', 1, 1]]);
  });
});
