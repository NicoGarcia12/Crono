import type { EventItem } from '@/types';

/**
 * Utilidades de fechas.
 *
 * 💡 Aprendizaje: las fechas se guardan como texto ISO ('YYYY-MM-DD') en SQLite
 * y solo se convierten a `Date` cuando hace falta calcular u ordenar.
 * Así se evitan problemas de zona horaria al persistir.
 */

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const WEEKDAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Convierte 'YYYY-MM-DD' (+ opcional 'HH:mm') a un Date en hora local. */
export function toLocalDate(isoDate: string, time?: string | null): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = (time ?? '00:00').split(':').map(Number);
  // new Date(y, m, d) interpreta en hora LOCAL (a diferencia de new Date('YYYY-MM-DD') que usa UTC).
  return new Date(year, month - 1, day, hour, minute);
}

/** Devuelve la fecha de hoy como 'YYYY-MM-DD' en hora local. */
export function todayIso(): string {
  return dateToIso(new Date());
}

export function dateToIso(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Próxima ocurrencia de un evento.
 * - Evento puntual: su propia fecha (aunque ya haya pasado, se muestra como pasado).
 * - Evento anual (cumpleaños/aniversario/festivo): la próxima vez que caiga ese día/mes.
 */
export function nextOccurrence(event: Pick<EventItem, 'date' | 'time' | 'yearly'>, from: Date = new Date()): Date {
  const base = toLocalDate(event.date, event.time);
  if (!event.yearly) return base;

  const candidate = new Date(from.getFullYear(), base.getMonth(), base.getDate(), base.getHours(), base.getMinutes());
  if (candidate.getTime() < from.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

/** Formatea 'YYYY-MM-DD' como 'martes 14 de julio de 2026'. */
export function formatLongDate(isoDate: string): string {
  const d = toLocalDate(isoDate);
  return `${WEEKDAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Formatea la próxima ocurrencia de forma corta: 'Hoy', 'Mañana', '14 jul' o '14 jul 2027'. */
export function formatRelative(next: Date, from: Date = new Date()): string {
  const startFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startNext = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  const diffDays = Math.round((startNext.getTime() - startFrom.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';

  const short = `${next.getDate()} ${MONTHS_ES[next.getMonth()].slice(0, 3)}`;
  if (next.getFullYear() !== from.getFullYear()) return `${short} ${next.getFullYear()}`;
  if (diffDays < 0) return `${short} (pasado)`;
  return short;
}

/** Días completos que faltan hasta la fecha (negativo si ya pasó). Ignora la hora. */
export function daysUntil(next: Date, from: Date = new Date()): number {
  const startFrom = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const startNext = new Date(next.getFullYear(), next.getMonth(), next.getDate());
  return Math.round((startNext.getTime() - startFrom.getTime()) / (1000 * 60 * 60 * 24));
}

/** Cuenta regresiva legible: 'Es hoy', 'Falta 1 día', 'Faltan 12 días', 'Hace 3 días'. */
export function countdownLabel(next: Date, from: Date = new Date()): string {
  const days = daysUntil(next, from);

  if (days === 0) return 'Es hoy';
  if (days === 1) return 'Falta 1 día';
  if (days > 1) return `Faltan ${days} días`;
  if (days === -1) return 'Fue ayer';
  return `Hace ${Math.abs(days)} días`;
}

/**
 * Primera letra en mayúscula ('julio 2026' → 'Julio 2026').
 * Ojo: el `textTransform: 'capitalize'` de los estilos NO sirve acá porque
 * capitaliza cada palabra ('Domingo 12 De Julio De 2026').
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Edad/años que se cumplen (para cumpleaños y aniversarios): años entre la fecha original y la ocurrencia. */
export function yearsSince(originalIso: string, occurrence: Date): number {
  const original = toLocalDate(originalIso);
  return occurrence.getFullYear() - original.getFullYear();
}

/**
 * Años que cumple (o cumplió) en el año en curso.
 *
 * 💡 Aprendizaje: acá "edad" no es la edad de hoy, sino la del año calendario:
 * alguien nacido en 1996 cumple 30 en 2026, tanto si su cumpleaños ya pasó
 * como si todavía no llegó. Es lo que se muestra en la agenda ("cumple 30").
 */
export function ageThisYear(originalIso: string, from: Date = new Date()): number {
  return from.getFullYear() - toLocalDate(originalIso).getFullYear();
}

/**
 * Inverso del anterior: si sé que cumple N este año, deduzco su año de
 * nacimiento y devuelvo la fecha con ese año (conservando día y mes).
 */
export function dateWithAgeThisYear(isoDate: string, age: number, from: Date = new Date()): string {
  const [, month, day] = isoDate.split('-');
  return `${from.getFullYear() - age}-${month}-${day}`;
}
