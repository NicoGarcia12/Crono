import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import type { EventItem, NewEvent } from '@/types';

/**
 * Importación de cumpleaños desde los contactos del celular.
 *
 * 💡 Aprendizaje: la lógica de "convertir contactos en eventos" es pura
 * (funciones sin efectos) y se testea con Jest sin celular. Solo
 * `fetchBirthdayCandidates` habla con el módulo nativo (permiso + lectura),
 * que es el límite del sistema — igual que hicimos con SQLite y notificaciones.
 */

export interface BirthdayCandidate {
  /** Id del contacto (o el nombre si el OS no da id). */
  key: string;
  name: string;
  /** Fecha 'YYYY-MM-DD'. Si el contacto no tiene año, se usa fallbackYear. */
  date: string;
  /** true si el contacto tenía año de nacimiento (permite mostrar la edad). */
  hasYear: boolean;
  /** true si ya existe un cumpleaños igual en la agenda (no se re-importa). */
  alreadyImported: boolean;
}

/** Lo mínimo que necesitamos de un contacto (shape de expo-contacts). */
export interface ContactLike {
  id?: string;
  name?: string;
  birthday?: { day?: number; month?: number; year?: number };
}

/**
 * Convierte el cumpleaños de expo-contacts a 'YYYY-MM-DD'.
 * ⚠️ Gotcha: expo-contacts devuelve el mes 0-indexado (estilo `Date` de JS):
 * enero = 0. En nuestro formato ISO enero = 01.
 */
export function birthdayToIso(
  birthday: { day: number; month: number; year?: number },
  fallbackYear: number,
): { date: string; hasYear: boolean } {
  const year = birthday.year ?? fallbackYear;
  const mm = String(birthday.month + 1).padStart(2, '0');
  const dd = String(birthday.day).padStart(2, '0');
  return { date: `${year}-${mm}-${dd}`, hasYear: birthday.year !== undefined };
}

/**
 * Arma la lista de candidatos a importar a partir de los contactos:
 * filtra los que no tienen nombre o cumpleaños válido, marca los que ya
 * están en la agenda y ordena alfabéticamente.
 */
export function buildCandidates(
  contacts: ContactLike[],
  existingEvents: Pick<EventItem, 'title' | 'type' | 'date'>[],
  fallbackYear: number = new Date().getFullYear(),
): BirthdayCandidate[] {
  // Índice de cumpleaños ya cargados: nombre normalizado + mes-día.
  const existing = new Set(
    existingEvents
      .filter((e) => e.type === 'cumpleanos')
      .map((e) => `${normalize(e.title)}|${e.date.slice(5)}`),
  );

  const candidates = contacts
    .filter(
      (c): c is ContactLike & { name: string; birthday: { day: number; month: number } } =>
        typeof c.name === 'string' &&
        c.name.trim().length > 0 &&
        typeof c.birthday?.day === 'number' &&
        typeof c.birthday?.month === 'number',
    )
    .map((c) => {
      const { date, hasYear } = birthdayToIso(
        { day: c.birthday.day, month: c.birthday.month, year: c.birthday.year },
        fallbackYear,
      );
      return {
        key: c.id ?? c.name,
        name: c.name.trim(),
        date,
        hasYear,
        alreadyImported: existing.has(`${normalize(c.name)}|${date.slice(5)}`),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  // Un contacto puede estar duplicado por una sincronización de la agenda.
  // La identidad funcional de un cumpleaños es nombre normalizado + mes/día;
  // el año no importa porque el evento se repite anualmente.
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${normalize(candidate.name)}|${candidate.date.slice(5)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Convierte un candidato en el evento que se guarda en la agenda. */
export function candidateToEvent(candidate: BirthdayCandidate): NewEvent {
  return {
    title: candidate.name,
    type: 'cumpleanos',
    date: candidate.date,
    time: null,
    description: null,
    reminders: [{ amount: 1, unit: 'dias' }], // aviso 1 día antes, igual que el default del formulario
    yearly: 1,
  };
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export type FetchCandidatesResult =
  | { status: 'ok'; candidates: BirthdayCandidate[] }
  | { status: 'denied' }
  | { status: 'unavailable' };

/**
 * Pide el permiso de contactos (recién acá, no al abrir la app) y devuelve
 * los candidatos. En web no existe la agenda de contactos.
 */
export async function fetchBirthdayCandidates(
  existingEvents: Pick<EventItem, 'title' | 'type' | 'date'>[],
): Promise<FetchCandidatesResult> {
  if (Platform.OS === 'web') return { status: 'unavailable' };

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };

  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Birthday] });
  return { status: 'ok', candidates: buildCandidates(data, existingEvents) };
}
