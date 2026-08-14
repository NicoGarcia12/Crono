import {
  birthdayToIso,
  buildCandidates,
  candidateToEvent,
  type BirthdayCandidate,
} from '@/contacts/birthday-import';

// El módulo importa expo-contacts (nativo) para fetchBirthdayCandidates;
// acá solo testeamos la lógica pura, así que alcanza con un mock vacío.
jest.mock('expo-contacts', () => ({}));

describe('birthdayToIso', () => {
  it('convierte el mes 0-indexado de expo-contacts a ISO (enero = 01)', () => {
    expect(birthdayToIso({ day: 5, month: 0, year: 1990 }, 2026)).toEqual({
      date: '1990-01-05',
      hasYear: true,
    });
  });

  it('usa el año de respaldo cuando el contacto no tiene año', () => {
    expect(birthdayToIso({ day: 20, month: 11 }, 2026)).toEqual({
      date: '2026-12-20',
      hasYear: false,
    });
  });
});

describe('buildCandidates', () => {
  const contacts = [
    { id: 'c1', name: 'Zoe', birthday: { day: 1, month: 1, year: 2000 } },
    { id: 'c2', name: 'Ana', birthday: { day: 20, month: 11 } },
    { id: 'c3', name: 'Sin cumpleaños' },
    { id: 'c4', name: '', birthday: { day: 3, month: 3 } },
    { id: 'c5', birthday: { day: 4, month: 4 } },
  ];

  it('filtra contactos sin nombre o sin cumpleaños y ordena alfabéticamente', () => {
    const candidates = buildCandidates(contacts, [], 2026);

    expect(candidates.map((c) => c.name)).toEqual(['Ana', 'Zoe']);
    expect(candidates[0]).toEqual({
      key: 'c2',
      name: 'Ana',
      date: '2026-12-20',
      hasYear: false,
      alreadyImported: false,
    });
  });

  it('marca como ya importados los que coinciden en nombre y día/mes (ignorando el año)', () => {
    const existing = [
      { title: 'ana', type: 'cumpleanos' as const, date: '1995-12-20' },
      { title: 'Zoe', type: 'evento' as const, date: '2000-02-01' }, // otro tipo: no cuenta
    ];

    const candidates = buildCandidates(contacts, existing, 2026);

    expect(candidates.find((c) => c.name === 'Ana')?.alreadyImported).toBe(true);
    expect(candidates.find((c) => c.name === 'Zoe')?.alreadyImported).toBe(false);
  });

  it('deduplica candidatos del mismo lote por nombre normalizado y día/mes', () => {
    const candidates = buildCandidates(
      [
        { id: 'c1', name: '  Ana  ', birthday: { day: 20, month: 11, year: 1995 } },
        { id: 'c2', name: 'ana', birthday: { day: 20, month: 11 } },
      ],
      [],
      2026,
    );

    expect(candidates).toHaveLength(1);
  });
});

describe('candidateToEvent', () => {
  it('crea un cumpleaños anual con aviso 1 día antes', () => {
    const candidate: BirthdayCandidate = {
      key: 'c1',
      name: 'Ana',
      date: '1995-12-20',
      hasYear: true,
      alreadyImported: false,
    };

    expect(candidateToEvent(candidate)).toEqual({
      title: 'Ana',
      type: 'cumpleanos',
      date: '1995-12-20',
      time: null,
      description: null,
      reminders: [{ amount: 1, unit: 'dias' }],
      yearly: 1,
    });
  });
});
