import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import {
  birthdayToIso,
  buildCandidates,
  candidateToEvent,
  fetchContacts,
  toContactLike,
  type ContactCandidate,
} from '@/contacts/birthday-import';
import type { EventItem } from '@/types';

// expo-contacts es nativo: lo reemplazamos por la forma de su API nueva
// (Contact.getAllDetails + ContactField), que es la que usa fetchContacts.
jest.mock('expo-contacts', () => ({
  requestPermissionsAsync: jest.fn(),
  ContactField: { FULL_NAME: 'fullName', BIRTHDAY: 'birthday', DATES: 'dates', PHONES: 'phones' },
  Contact: { getAllDetails: jest.fn() },
}));

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
  tags: [],
  photoUri: null,
  ...over,
});

describe('birthdayToIso', () => {
  it('convierte el mes 1-12 de expo-contacts a ISO (enero = 01)', () => {
    expect(birthdayToIso({ day: 5, month: 1, year: 1990 }, 2026)).toEqual({
      date: '1990-01-05',
      hasYear: true,
    });
  });

  it('usa el año de respaldo cuando el contacto no tiene año', () => {
    expect(birthdayToIso({ day: 20, month: 12 }, 2026)).toEqual({
      date: '2026-12-20',
      hasYear: false,
    });
  });
});

describe('toContactLike', () => {
  it('adapta los campos de la API nueva (fullName, phones, birthday)', () => {
    expect(
      toContactLike({
        id: 'c9',
        fullName: 'Ana Gómez',
        phones: [{ number: '+54 9 11 5555-0009' }],
        birthday: { day: 20, month: 12, year: 1995 },
      }),
    ).toEqual({
      id: 'c9',
      name: 'Ana Gómez',
      phoneNumbers: [{ number: '+54 9 11 5555-0009' }],
      birthday: { day: 20, month: 12, year: 1995 },
    });
  });

  it('un contacto sin cumpleaños (birthday null) queda sin fecha sugerida', () => {
    const contact = toContactLike({ id: 'c1', fullName: 'Zoe', birthday: null });

    expect(contact.birthday).toBeUndefined();
  });

  it('en Android toma el cumpleaños de dates (label birthday) e ignora otras fechas', () => {
    const contact = toContactLike({
      id: 'c3',
      fullName: 'Bruno',
      dates: [
        { label: 'anniversary', date: { day: 1, month: 6, year: 2010 } },
        { label: 'birthday', date: { day: 5, month: 3 } },
      ],
    });

    expect(contact.birthday).toEqual({ day: 5, month: 3 });
  });
});

describe('fetchContacts', () => {
  const mocked = Contacts as unknown as {
    requestPermissionsAsync: jest.Mock;
    Contact: { getAllDetails: jest.Mock };
  };

  it('si no dan el permiso devuelve denied y no lee contactos', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mocked.Contact.getAllDetails.mockClear();

    await expect(fetchContacts([])).resolves.toEqual({ status: 'denied' });
    expect(mocked.Contact.getAllDetails).not.toHaveBeenCalled();
  });

  it('con permiso lee nombre, cumpleaños y teléfonos con la API nueva', async () => {
    mocked.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mocked.Contact.getAllDetails.mockResolvedValue([
      {
        id: 'c2',
        fullName: 'Ana',
        phones: [{ number: '+54 9 11 5555-0002' }],
        birthday: { day: 5, month: 1, year: 1990 },
      },
    ]);

    const result = await fetchContacts([]);

    expect(mocked.Contact.getAllDetails).toHaveBeenCalledWith(['fullName', 'birthday', 'phones']);
    expect(result).toEqual({
      status: 'ok',
      candidates: [
        {
          key: 'c2',
          name: 'Ana',
          phone: '+54 9 11 5555-0002',
          suggestedDate: '1990-01-05',
          suggestedHasYear: true,
          loaded: null,
        },
      ],
    });
  });

  it('en Android pide dates (no birthday) y precarga el cumpleaños desde ahí', async () => {
    const original = Platform.OS;
    Platform.OS = 'android';
    try {
      mocked.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
      mocked.Contact.getAllDetails.mockResolvedValue([
        { id: 'c5', fullName: 'Eva', dates: [{ label: 'birthday', date: { day: 9, month: 11 } }] },
      ]);

      const result = await fetchContacts([]);

      expect(mocked.Contact.getAllDetails).toHaveBeenCalledWith(['fullName', 'dates', 'phones']);
      expect(result).toMatchObject({
        status: 'ok',
        candidates: [{ key: 'c5', suggestedDate: `${new Date().getFullYear()}-11-09` }],
      });
    } finally {
      Platform.OS = original;
    }
  });
});

describe('buildCandidates', () => {
  const contacts = [
    { id: 'c1', name: 'Zoe', phoneNumbers: [{ number: '+54 9 11 5555-0001' }] },
    { id: 'c2', name: 'Ana', birthday: { day: 20, month: 12, year: 1995 } },
    { id: 'c3', name: 'Bruno', birthday: { day: 5, month: 3 } }, // sin año
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
        { id: 'c1', name: '  Ana  ', birthday: { day: 20, month: 12, year: 1995 } },
        { id: 'c2', name: 'ana', birthday: { day: 20, month: 12 } },
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
      tags: [],
      photoUri: null,
    });
  });
});
