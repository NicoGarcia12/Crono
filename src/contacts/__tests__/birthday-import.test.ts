import {
  birthdayToIso,
  buildCandidates,
  candidateToEvent,
  type ContactCandidate,
} from '@/contacts/birthday-import';
import type { EventItem } from '@/types';

// El módulo importa expo-contacts (nativo) para fetchContacts; acá solo
// testeamos la lógica pura, así que alcanza con un mock vacío.
jest.mock('expo-contacts', () => ({}));

const evento = (over: Partial<EventItem>): EventItem => ({
  id: 1,
  title: 'Ana',
  type: 'cumpleanos',
  date: '1995-12-20',
  time: null,
  description: null,
  contactId: null,
  phone: null,
  reminders: [],
  yearly: 1,
  isMine: 0,
  ...over,
});

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
    { id: 'c1', name: 'Zoe', phoneNumbers: [{ number: '+54 9 11 5555-0001' }] },
    { id: 'c2', name: 'Ana', birthday: { day: 20, month: 11, year: 1995 } },
    { id: 'c3', name: 'Bruno', birthday: { day: 5, month: 2 } }, // sin año
    { id: 'c4', name: '   ' }, // sin nombre útil
  ];

  it('lista TODOS los contactos con nombre, ordenados alfabéticamente', () => {
    const candidates = buildCandidates(contacts, [], 2026);

    // Zoe entra aunque no tenga cumpleaños en la agenda del celular.
    expect(candidates.map((c) => c.name)).toEqual(['Ana', 'Bruno', 'Zoe']);
  });

  it('precarga la fecha y el teléfono que trae el contacto', () => {
    const candidates = buildCandidates(contacts, [], 2026);

    expect(candidates.find((c) => c.name === 'Ana')).toMatchObject({
      suggestedDate: '1995-12-20',
      suggestedHasYear: true,
      loaded: null,
    });
    // Sin año: se sugiere con el año actual, avisando que no es real.
    expect(candidates.find((c) => c.name === 'Bruno')).toMatchObject({
      suggestedDate: '2026-03-05',
      suggestedHasYear: false,
    });
    expect(candidates.find((c) => c.name === 'Zoe')).toMatchObject({
      phone: '+54 9 11 5555-0001',
      suggestedDate: null,
    });
  });

  it('marca como YA CARGADO al contacto que tiene su cumpleaños en la agenda', () => {
    const existing = [evento({ id: 7, contactId: 'c2', date: '1995-12-20' })];

    const candidates = buildCandidates(contacts, existing, 2026);

    expect(candidates.find((c) => c.name === 'Ana')?.loaded).toEqual({
      eventId: 7,
      date: '1995-12-20',
    });
    expect(candidates.find((c) => c.name === 'Zoe')?.loaded).toBeNull();
  });

  it('no confunde eventos cargados a mano (sin contacto) ni de otro tipo', () => {
    const existing = [
      evento({ id: 8, contactId: null, title: 'Ana' }), // cargado a mano
      evento({ id: 9, contactId: 'c1', type: 'aniversario' }), // no es cumpleaños
    ];

    const candidates = buildCandidates(contacts, existing, 2026);

    expect(candidates.every((c) => c.loaded === null)).toBe(true);
  });

  it('conserva contactos distintos aunque compartan nombre y cumpleaños', () => {
    const candidates = buildCandidates(
      [
        { id: 'c1', name: '  Ana  ', birthday: { day: 20, month: 11, year: 1995 } },
        { id: 'c2', name: 'ana', birthday: { day: 20, month: 11 } },
      ],
      [],
      2026,
    );

    // La identidad de esta pantalla es el id nativo del contacto. Deduplicar
    // por nombre+fecha ocultaría personas distintas de la agenda.
    expect(candidates.map((candidate) => candidate.key).sort()).toEqual(['c1', 'c2']);
  });
});

describe('candidateToEvent', () => {
  it('crea un cumpleaños anual, con teléfono y contacto, avisando 1 día antes', () => {
    const candidate: ContactCandidate = {
      key: 'c2',
      name: 'Ana',
      phone: '+54 9 11 5555-0002',
      suggestedDate: '1995-12-20',
      suggestedHasYear: true,
      loaded: null,
    };

    expect(candidateToEvent(candidate, '1995-12-20')).toEqual({
      title: 'Ana',
      type: 'cumpleanos',
      date: '1995-12-20',
      time: null,
      description: null,
      contactId: 'c2',
      phone: '+54 9 11 5555-0002',
      reminders: [{ amount: 1, unit: 'dias' }],
      yearly: 1,
      isMine: 0,
    });
  });
});
