import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

import type { EventItem, NewEvent } from '@/types';

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

/** Lo mínimo que necesitamos de un contacto (shape de expo-contacts). */
export interface ContactLike {
  id?: string;
  name?: string;
  phoneNumbers?: { number?: string }[];
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

/** Convierte un contacto + la fecha elegida en el evento que se guarda en la agenda. */
export function candidateToEvent(candidate: ContactCandidate, date: string): NewEvent {
  return {
    title: candidate.name,
    type: 'cumpleanos',
    date,
    time: null,
    description: null,
    contactId: candidate.key,
    phone: candidate.phone,
    reminders: [{ amount: 1, unit: 'dias' }], // aviso 1 día antes, igual que el default del formulario
    yearly: 1,
    isMine: 0, // el cumpleaños propio se carga aparte desde Perfil
  };
}

export type FetchContactsResult =
  | { status: 'ok'; candidates: ContactCandidate[] }
  | { status: 'denied' }
  | { status: 'unavailable' };

/**
 * Pide el permiso de contactos (recién acá, no al abrir la app) y devuelve
 * la lista completa. En web no existe la agenda de contactos.
 */
export async function fetchContacts(existingEvents: EventItem[]): Promise<FetchContactsResult> {
  if (Platform.OS === 'web') return { status: 'unavailable' };

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { status: 'denied' };

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Birthday, Contacts.Fields.PhoneNumbers],
  });
  return { status: 'ok', candidates: buildCandidates(data, existingEvents) };
}
