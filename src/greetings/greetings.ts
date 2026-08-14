import type { EventItem, Greeting } from '@/types';

/**
 * La lista de "¿quién me saludó?" combina dos cosas:
 *  - todas las personas cuyo cumpleaños tengo cargado en la agenda;
 *  - las que anoté a mano ese año (no están en mi agenda).
 *
 * El estado (saludó / no saludó) vive por AÑO: cada año la lista arranca
 * limpia sin borrar nada del año anterior.
 */

export interface GreetingRow {
  /** Clave estable para la lista: 'evento:12' o 'invitado:34'. */
  key: string;
  name: string;
  phone: string | null;
  greeted: boolean;
  /** Cumpleaños de esa persona en mi agenda (null si la anoté a mano). */
  eventId: number | null;
  /** Fila guardada en la BD, si ya existe. */
  greetingId: number | null;
  /** true si la anoté a mano (se puede borrar de la lista y cargarle el cumple). */
  isGuest: boolean;
}

/**
 * Arma la lista del año: los cumpleaños de la agenda (menos el mío) más los
 * invitados anotados a mano, ordenados alfabéticamente.
 */
export function buildGreetingRows(events: EventItem[], greetings: Greeting[]): GreetingRow[] {
  const byEvent = new Map<number, Greeting>();
  const guests: Greeting[] = [];

  for (const greeting of greetings) {
    if (greeting.eventId === null) guests.push(greeting);
    else byEvent.set(greeting.eventId, greeting);
  }

  const fromAgenda: GreetingRow[] = events
    .filter((event) => event.type === 'cumpleanos' && !event.isMine)
    .map((event) => {
      const saved = byEvent.get(event.id);
      return {
        key: `evento:${event.id}`,
        name: event.title,
        phone: event.phone,
        greeted: saved?.greeted === 1,
        eventId: event.id,
        greetingId: saved?.id ?? null,
        isGuest: false,
      };
    });

  const fromGuests: GreetingRow[] = guests.map((guest) => ({
    key: `invitado:${guest.id}`,
    name: guest.name,
    phone: guest.phone,
    greeted: guest.greeted === 1,
    eventId: null,
    greetingId: guest.id,
    isGuest: true,
  }));

  return [...fromAgenda, ...fromGuests].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Resumen para el encabezado: 'Te saludaron 3 de 12'. */
export function greetingsSummary(rows: GreetingRow[]): { greeted: number; total: number } {
  return { greeted: rows.filter((r) => r.greeted).length, total: rows.length };
}
