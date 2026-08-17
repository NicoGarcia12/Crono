import { setEventTags } from '@/db/tags-repo';

/** Fake mínimo de SQLite: una tabla `tags` en memoria + un log de deletes/inserts. */
function fakeDb() {
  const tags: { id: number; name: string }[] = [{ id: 1, name: 'familia' }];
  let nextId = 2;
  const deletes: unknown[][] = [];
  const inserts: unknown[][] = [];

  return {
    tags,
    deletes,
    inserts,
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      if (sql.startsWith('SELECT id FROM tags')) {
        const name = params[0];
        const found = tags.find((t) => t.name.toLowerCase() === String(name).toLowerCase());
        return (found ? { id: found.id } : null) as T | null;
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      if (sql.startsWith('INSERT INTO tags')) {
        const id = nextId++;
        tags.push({ id, name: params[0] as string });
        inserts.push(['tags', ...params]);
        return { lastInsertRowId: id, changes: 1 };
      }
      if (sql.startsWith('DELETE FROM event_tags')) {
        deletes.push(params);
        return { lastInsertRowId: 0, changes: 1 };
      }
      if (sql.startsWith('INSERT INTO event_tags')) {
        inserts.push(['event_tags', ...params]);
        return { lastInsertRowId: 0, changes: 1 };
      }
      throw new Error(`SQL inesperado: ${sql}`);
    },
  };
}

describe('setEventTags', () => {
  it('reutiliza una etiqueta existente sin importar mayúsculas', async () => {
    const db = fakeDb();

    const result = await setEventTags(db, 5, ['Familia']);

    expect(result).toEqual([{ id: 1, name: 'Familia' }]);
    expect(db.tags).toHaveLength(1); // no creó una fila nueva
  });

  it('crea las etiquetas que no existen y descarta nombres vacíos o repetidos', async () => {
    const db = fakeDb();

    const result = await setEventTags(db, 5, ['familia', '  ', 'trabajo', 'Trabajo']);

    expect(result).toEqual([
      { id: 1, name: 'familia' },
      { id: 2, name: 'trabajo' },
    ]);
  });

  it('siempre limpia la tabla puente antes de volver a insertar', async () => {
    const db = fakeDb();

    await setEventTags(db, 5, []);

    expect(db.deletes).toEqual([[5]]);
    expect(db.inserts).toEqual([]); // sin etiquetas, no inserta nada
  });
});
