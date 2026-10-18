import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import type { EventItem, NewEvent } from '@/types';

import { fetchAllowedContactIds } from './account-filter';

/**
 * Cargar cumpleaños desde la agenda de contactos del celular.
 *
 * Flujo: se listan TODOS los contactos → el usuario tilda a quiénes quiere
 * cargarles el cumpleaños → se les pone la fecha de a uno (si el contacto ya
 * la trae en la agenda del celular, viene precargada).
 *
 * 💡 Aprendizaje: la lógica de armar la lista y convertir a evento es pura
 * (funciones sin efectos) y se testea con Jest sin celular. Solo
 * `fetchContacts` habla con el módulo nativo (permiso + lectura), que es el
 * límite del sistema — igual que hicimos con SQLite y notificaciones.
 */

/** Cumpleaños ya cargado en la agenda de Crono para ese contacto. */
export interface LoadedBirthday {
  eventId: number;
  /** Fecha 'YYYY-MM-DD' con la que quedó cargado. */
  date: string;
}

export interface ContactCandidate {
  /** Id del contacto en el celular (o el nombre si el OS no da id). */
  key: string;
  name: string;
  /** Teléfono principal; se guarda con el evento para poder saludarlo. */
  phone: string | null;
  /** Fecha sugerida 'YYYY-MM-DD' si el contacto ya tiene cumpleaños en la agenda del celular. */
  suggestedDate: string | null;
  /** Si el contacto no tenía año de nacimiento, la fecha sugerida usa el año actual. */
  suggestedHasYear: boolean;
  /** Presente si su cumpleaños YA está cargado en Crono. */
  loaded: LoadedBirthday | null;
}

/** Lo mínimo que necesitamos de un contacto. */
export interface ContactLike {
  id?: string;
  name?: string;
  phoneNumbers?: { number?: string }[];
  birthday?: { day?: number; month?: number; year?: number };
}

/** Lo que devuelve `Contact.getAllDetails` (API nueva de expo-contacts) para los campos que pedimos. */
export interface ContactDetailsLike {
  id: string;
  fullName?: string | null;
  phones?: { number?: string }[] | null;
  birthday?: { day?: number; month?: number; year?: number } | null;
  /** Android no tiene `birthday`: el cumpleaños viene acá con label 'birthday'. */
  dates?: { label?: string; date?: { day?: number; month?: number; year?: number } }[] | null;
}

/**
 * Adapta un contacto de la API nueva de expo-contacts a la forma que usa esta pantalla.
 * ⚠️ Gotcha: el campo `birthday` es solo de iOS. En Android el cumpleaños es una
 * fecha dentro de `dates` con label 'birthday'.
 */
export function toContactLike(details: ContactDetailsLike): ContactLike {
  const androidBirthday = details.dates?.find((d) => d.label?.toLowerCase() === 'birthday')?.date;
  return {
    id: details.id,
    name: details.fullName ?? undefined,
    phoneNumbers: details.phones ?? undefined,
    birthday: details.birthday ?? androidBirthday ?? undefined,
  };
}

/**
 * Convierte el cumpleaños de expo-contacts a 'YYYY-MM-DD'.
 * ⚠️ Gotcha: la API nueva de expo-contacts usa el mes 1-12 (enero = 1), a
 * diferencia de la API vieja (`getContactsAsync`), que lo devolvía 0-indexado.
 */
export function birthdayToIso(
  birthday: { day: number; month: number; year?: number },
  fallbackYear: number,
): { date: string; hasYear: boolean } {
  const year = birthday.year ?? fallbackYear;
  const mm = String(birthday.month).padStart(2, '0');
  const dd = String(birthday.day).padStart(2, '0');
  return { date: `${year}-${mm}-${dd}`, hasYear: birthday.year !== undefined };
}

/**
 * Arma la lista de contactos para la pantalla: TODOS los que tengan nombre,
 * marcando cuáles ya tienen su cumpleaños cargado en Crono y precargando la
 * fecha de los que la traen del celular. Ordenados alfabéticamente.
 */
export function buildCandidates(
  contacts: ContactLike[],
  existingEvents: EventItem[],
  fallbackYear: number = new Date().getFullYear(),
): ContactCandidate[] {
  // Índice de los cumpleaños ya cargados desde contactos, por id de contacto.
  const loadedByContact = new Map<string, LoadedBirthday>();
  for (const event of existingEvents) {
    if (event.type === 'cumpleanos' && event.contactId) {
      loadedByContact.set(event.contactId, { eventId: event.id, date: event.date });
    }
  }

  return contacts
    .filter((c): c is ContactLike & { name: string } => (c.name ?? '').trim().length > 0)
    // Solo contactos con teléfono: los que no tienen número suelen ser basura (apps, cuentas, etc.).
    .filter((c) => (c.phoneNumbers ?? []).some((p) => (p.number ?? '').trim().length > 0))
    .map((contact) => {
      const key = contact.id ?? contact.name;
      const birthday = contact.birthday;
      const suggested =
        typeof birthday?.day === 'number' && typeof birthday?.month === 'number'
          ? birthdayToIso(
              { day: birthday.day, month: birthday.month, year: birthday.year },
              fallbackYear,
            )
          : null;

      return {
        key,
        name: contact.name.trim(),
        phone: contact.phoneNumbers?.[0]?.number?.trim() ?? null,
        suggestedDate: suggested?.date ?? null,
        suggestedHasYear: suggested?.hasYear ?? false,
        loaded: loadedByContact.get(key) ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Convierte un contacto + la fecha elegida en el evento que se guarda en la agenda.
 * Si se usa la fecha sugerida y el contacto no traía año, queda marcado como
 * "año desconocido" (el año de la fecha es solo de relleno).
 */
export function candidateToEvent(
  candidate: ContactCandidate,
  date: string,
  name: string = candidate.name,
): NewEvent {
  const yearUnknown = date === candidate.suggestedDate && !candidate.suggestedHasYear ? 1 : 0;
  return {
    title: name,
    type: 'cumpleanos',
    date,
    time: null,
    description: null,
    contactId: candidate.key,
    phone: candidate.phone,
    reminders: [{ amount: 1, unit: 'dias' }], // aviso 1 día antes, igual que el default del formulario
    yearly: 1,
    isMine: 0, // el cumpleaños propio se carga aparte desde Perfil
    tags: [],
    photoUri: null,
    yearUnknown,
  };
}

export type FetchContactsResult =
  | { status: 'ok'; candidates: ContactCandidate[] }
  | { status: 'denied' }
  | { status: 'unavailable' };

/**
 * Pide el permiso de contactos (recién acá, no al abrir la app) y devuelve
 * los contactos de las cuentas propias (ver `account-filter`). En web no existe
 * la agenda de contactos.
 */
export async function fetchContacts(existingEvents: EventItem[]): Promise<FetchContactsResult> {
  if (Platform.OS === 'web') return { status: 'unavailable' };

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };

  // Pedir `birthday` en Android rompe el módulo nativo (el enum no lo tiene).
  const birthdayField =
    Platform.OS === 'ios' ? Contacts.ContactField.BIRTHDAY : Contacts.ContactField.DATES;
  const details = await Contacts.Contact.getAllDetails([
    Contacts.ContactField.FULL_NAME,
    birthdayField,
    Contacts.ContactField.PHONES,
  ]);
  const allowedIds = await fetchAllowedContactIds();
  const fromAllowedAccounts = allowedIds ? details.filter((d) => allowedIds.has(d.id)) : details;
  return {
    status: 'ok',
    candidates: buildCandidates(fromAllowedAccounts.map(toContactLike), existingEvents),
  };
}
