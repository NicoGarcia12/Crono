import { getDb } from '@/db/database';
import { findAllCustomFields, findAllEventBases } from '@/db/event-bases-repo';

jest.mock('@/db/database', () => ({ getDb: jest.fn() }));

function fakeDb(rows: unknown[]) {
  return { getAllAsync: jest.fn().mockResolvedValue(rows) };
}

describe('findAllEventBases', () => {
  it('convierte los 0/1 de SQLite a booleanos y lee las capacidades del JSON', async () => {
    jest.mocked(getDb).mockReturnValue(
      fakeDb([
        { id: 2, key: 'cumpleanos', label: 'Cumpleaños', yearly: 1, requiresTime: 0, capabilities: '["edad","regalos"]', isBuiltin: 1 },
      ]) as never,
    );

    expect(await findAllEventBases()).toEqual([
      { id: 2, key: 'cumpleanos', label: 'Cumpleaños', yearly: true, requiresTime: false, capabilities: ['edad', 'regalos'], isBuiltin: true },
    ]);
  });

  it('ignora capacidades desconocidas o un JSON corrupto en vez de romper la carga', async () => {
    jest.mocked(getDb).mockReturnValue(
      fakeDb([
        { id: 1, key: 'a', label: 'A', yearly: 0, requiresTime: 0, capabilities: '["edad","volar"]', isBuiltin: 0 },
        { id: 2, key: 'b', label: 'B', yearly: 0, requiresTime: 0, capabilities: '{roto', isBuiltin: 0 },
      ]) as never,
    );

    const [a, b] = await findAllEventBases();
    expect(a.capabilities).toEqual(['edad']);
    expect(b.capabilities).toEqual([]);
  });
});

describe('findAllCustomFields', () => {
  it('distingue campos de una base (obligatorios) de los de un tipo (extras)', async () => {
    jest.mocked(getDb).mockReturnValue(
      fakeDb([
        { id: 1, baseId: 5, typeId: null, label: 'Obra social', kind: 'texto', options: '[]', position: 0 },
        { id: 2, baseId: null, typeId: 8, label: 'Qué llevar', kind: 'multi', options: '["Torta","Bebida"]', position: 1 },
      ]) as never,
    );

    expect(await findAllCustomFields()).toEqual([
      { id: 1, owner: 'base', ownerId: 5, label: 'Obra social', kind: 'texto', options: [], position: 0 },
      { id: 2, owner: 'type', ownerId: 8, label: 'Qué llevar', kind: 'multi', options: ['Torta', 'Bebida'], position: 1 },
    ]);
  });

  it('omite campos de una clase desconocida', async () => {
    jest.mocked(getDb).mockReturnValue(
      fakeDb([{ id: 1, baseId: 5, typeId: null, label: 'X', kind: 'fecha', options: '[]', position: 0 }]) as never,
    );

    expect(await findAllCustomFields()).toEqual([]);
  });
});
