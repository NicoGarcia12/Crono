import { fieldDraftProblem, isEmptyPlan, parseMultiValue, parseOptionsText, planRemovals } from '@/constants/event-bases';

describe('planRemovals', () => {
  const before = {
    capabilities: ['regalos', 'whatsapp'] as const,
    fields: [
      { id: 1, options: [] },
      { id: 2, options: ['Torta', 'Bebida', 'Globos'] },
    ],
  };

  it('detecta capacidades quitadas, campos borrados y opciones sacadas', () => {
    const plan = planRemovals(
      { capabilities: [...before.capabilities], fields: before.fields },
      {
        capabilities: ['whatsapp'],
        fields: [{ id: 2, label: 'Qué llevar', kind: 'multi', options: ['Torta'] }, { label: 'Nuevo', kind: 'texto', options: [] }],
      },
    );

    expect(plan).toEqual({
      capabilities: ['regalos'],
      fieldIds: [1],
      options: [{ fieldId: 2, removed: ['Bebida', 'Globos'] }],
    });
    expect(isEmptyPlan(plan)).toBe(false);
  });

  it('si no se quita nada, el plan está vacío (agregar no borra nada)', () => {
    const plan = planRemovals(
      { capabilities: ['regalos'], fields: [{ id: 2, options: ['Torta'] }] },
      { capabilities: ['regalos', 'whatsapp'], fields: [{ id: 2, label: 'X', kind: 'select', options: ['Torta', 'Vino'] }] },
    );

    expect(isEmptyPlan(plan)).toBe(true);
  });
});

describe('fieldDraftProblem', () => {
  it('pide nombre, opciones en select/multi y nombres sin repetir', () => {
    expect(fieldDraftProblem([{ label: ' ', kind: 'texto', options: [] }])).toMatch(/nombre/);
    expect(fieldDraftProblem([{ label: 'Talle', kind: 'select', options: [] }])).toMatch(/al menos una opción/);
    expect(
      fieldDraftProblem([
        { label: 'Talle', kind: 'texto', options: [] },
        { label: 'talle ', kind: 'numero', options: [] },
      ]),
    ).toMatch(/mismo nombre/);
    expect(fieldDraftProblem([{ label: 'Talle', kind: 'select', options: ['S', 'M'] }])).toBeNull();
  });
});

describe('valores de opciones', () => {
  it('lee la lista de un multi y tolera datos corruptos', () => {
    expect(parseMultiValue('["Torta","Bebida"]')).toEqual(['Torta', 'Bebida']);
    expect(parseMultiValue('{roto')).toEqual([]);
    expect(parseMultiValue(undefined)).toEqual([]);
  });

  it('separa las opciones por coma, sin vacías ni repetidas', () => {
    expect(parseOptionsText(' Torta, Bebida,, Torta ,')).toEqual(['Torta', 'Bebida']);
  });
});
