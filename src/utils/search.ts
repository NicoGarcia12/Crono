import { EVENT_TYPE_META } from '@/constants/event-types';
import type { EventItem, Note } from '@/types';

/**
 * Búsqueda de eventos y notas.
 *
 * 💡 Aprendizaje: buscar "mama" tiene que encontrar "Cumple de mamá". Por eso
 * se normaliza el texto (minúsculas y sin tildes) antes de comparar: es lo que
 * espera cualquier usuario, que no va a escribir los acentos en el buscador.
 */

/**
 * Minúsculas y sin tildes, para comparar como compara la cabeza al leer.
 * La ñ también se pliega a n (buscar 'cumpleanos' encuentra 'cumpleaños').
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD') // separa la letra de su tilde ('á' → 'a' + '´')
    .replace(/[̀-ͯ]/g, '') // borra las tildes ya separadas
    .trim();
}

/** true si TODAS las palabras de la búsqueda aparecen en alguno de los campos. */
export function matches(query: string, fields: (string | null)[]): boolean {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true; // sin búsqueda, entra todo

  const haystack = fields.filter(Boolean).map((f) => normalizeText(f as string)).join(' ');
  return words.every((word) => haystack.includes(word));
}

/** Busca en título, descripción y en el nombre del tipo ('cita médica'). */
export function filterEvents(events: EventItem[], query: string): EventItem[] {
  if (normalizeText(query).length === 0) return events;

  return events.filter((event) =>
    matches(query, [event.title, event.description, EVENT_TYPE_META[event.type].label]),
  );
}

/** Busca en el título y el contenido de las notas. */
export function filterNotes(notes: Note[], query: string): Note[] {
  if (normalizeText(query).length === 0) return notes;

  return notes.filter((note) => matches(query, [note.title, note.content]));
}
