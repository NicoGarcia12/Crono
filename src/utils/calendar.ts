import type { EventItem } from '@/types';
import { dateToIso, toLocalDate } from '@/utils/dates';

/**
 * Lógica del calendario: armar la grilla de días y saber qué eventos caen en
 * cada uno. Todo puro (sin React ni BD) para poder testearlo con Jest.
 *
 * 💡 Aprendizaje: los eventos anuales (cumpleaños, aniversarios, festivos) se
 * guardan una sola vez con su fecha original, pero en el calendario tienen que
 * aparecer TODOS los años. Por eso no alcanza con comparar fechas: hay que
 * calcular sus ocurrencias dentro del rango que se está mirando.
 */

export type CalendarMode = 'mes' | 'semana';

/** Lunes de la semana a la que pertenece esa fecha (la semana arranca en lunes). */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 = domingo … 6 = sábado. Queremos que el lunes sea el día 0.
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

/** Los 7 días (lunes a domingo) de la semana que contiene a `anchor`. */
export function buildWeek(anchor: Date): Date[] {
  const monday = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return day;
  });
}

/**
 * Grilla del mes: semanas completas de lunes a domingo. Incluye los días del
 * mes anterior y del siguiente que completan la primera y la última semana
 * (así la grilla siempre es rectangular, como cualquier calendario).
 */
export function buildMonthGrid(anchor: Date): Date[][] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  const weeks: Date[][] = [];
  let cursor = startOfWeek(firstOfMonth);

  while (cursor <= lastOfMonth || weeks.length === 0) {
    weeks.push(buildWeek(cursor));
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** Mueve el ancla N meses (puede ser negativo). Fija el día 1 para no "perder" meses cortos. */
export function shiftMonth(anchor: Date, delta: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1);
}

/** Mueve el ancla N semanas (puede ser negativo). */
export function shiftWeek(anchor: Date, delta: number): Date {
  const result = new Date(anchor);
  result.setDate(result.getDate() + delta * 7);
  return result;
}

/** Indica si febrero tiene 29 días en el año indicado. */
function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Fecha ISO de la ocurrencia anual de un evento en un año concreto.
 *
 * `new Date(year, 1, 29)` se desborda a marzo en un año no bisiesto. La regla
 * de producto elige el 28/02, por eso tratamos el caso antes de crear el Date.
 */
function annualOccurrenceIso(base: Date, year: number): string {
  const isLeapDay = base.getMonth() === 1 && base.getDate() === 29;
  const day = isLeapDay && !isLeapYear(year) ? 28 : base.getDate();

  return dateToIso(new Date(year, base.getMonth(), day));
}

/**
 * Agrupa los eventos por día ('YYYY-MM-DD') dentro del rango visible.
 * Los eventos anuales se repiten en cada año del rango; los puntuales
 * aparecen solo en su fecha.
 */
export function eventsByDay(events: EventItem[], days: Date[]): Map<string, EventItem[]> {
  if (days.length === 0) return new Map();

  const visible = new Set(days.map(dateToIso));
  const years = new Set(days.map((d) => d.getFullYear()));
  const byDay = new Map<string, EventItem[]>();

  const push = (iso: string, event: EventItem) => {
    if (!visible.has(iso)) return;
    const list = byDay.get(iso) ?? [];
    list.push(event);
    byDay.set(iso, list);
  };

  for (const event of events) {
    const base = toLocalDate(event.date);

    if (!event.yearly) {
      push(event.date, event);
      continue;
    }

    // Anual: la misma combinación día/mes, en cada año que toque la grilla.
    for (const year of years) {
      push(annualOccurrenceIso(base, year), event);
    }
  }

  return byDay;
}

/**
 * Cumpleaños y aniversarios AJENOS (no `isMine`) que caen en el mes de
 * `anchor`. Los anuales se repiten todos los años (se compara solo el mes);
 * los puntuales, además, tienen que ser de ese año. Ordenados por día.
 */
export function birthdaysAndAnniversariesInMonth(events: EventItem[], anchor: Date): EventItem[] {
  const month = anchor.getMonth();
  const year = anchor.getFullYear();

  return events
    .filter((event) => event.type === 'cumpleanos' || event.type === 'aniversario')
    .filter((event) => event.isMine !== 1)
    .filter((event) => {
      const base = toLocalDate(event.date);
      if (base.getMonth() !== month) return false;
      return event.yearly ? true : base.getFullYear() === year;
    })
    .sort((a, b) => toLocalDate(a.date).getDate() - toLocalDate(b.date).getDate());
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Título del período que se está mirando: 'julio 2026' o '6 – 12 de julio de 2026'. */
export function periodLabel(anchor: Date, mode: CalendarMode): string {
  if (mode === 'mes') {
    return `${MONTHS_ES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }

  const week = buildWeek(anchor);
  const from = week[0];
  const to = week[6];

  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()} – ${to.getDate()} de ${MONTHS_ES[from.getMonth()]} de ${from.getFullYear()}`;
  }
  const fromLabel = `${from.getDate()} de ${MONTHS_ES[from.getMonth()]}`;
  const toLabel = `${to.getDate()} de ${MONTHS_ES[to.getMonth()]}`;
  return `${fromLabel} – ${toLabel} de ${to.getFullYear()}`;
}

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
