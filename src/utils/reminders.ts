import type { ReminderInput, ReminderUnit } from '@/types';

/**
 * Cálculo y formato de los avisos.
 *
 * 💡 Aprendizaje: no todas las unidades se pueden expresar en minutos fijos.
 * Un mes no dura siempre lo mismo, así que "1 mes antes" se calcula sobre el
 * CALENDARIO (mismo número de día en el mes anterior), no restando 30 días.
 */

const MINUTES_PER_UNIT: Record<Exclude<ReminderUnit, 'meses'>, number> = {
  minutos: 1,
  horas: 60,
  dias: 60 * 24,
  semanas: 60 * 24 * 7,
};

/** Último día que existe en ese mes (28/29/30/31). */
function lastDayOfMonth(year: number, month: number): number {
  // El día 0 del mes siguiente es el último del mes pedido.
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Momento en que debe sonar un aviso: la fecha del evento menos la anticipación.
 *
 * Con unidad 'meses' se retrocede por calendario y se RECORTA al último día
 * del mes destino si el día no existe: el 31 de marzo menos 1 mes avisa el 28
 * de febrero (29 en año bisiesto), no el 3 de marzo.
 */
export function reminderDate(occurrence: Date, reminder: ReminderInput): Date {
  if (reminder.unit !== 'meses') {
    const minutes = reminder.amount * MINUTES_PER_UNIT[reminder.unit];
    return new Date(occurrence.getTime() - minutes * 60 * 1000);
  }

  const targetMonthStart = new Date(
    occurrence.getFullYear(),
    occurrence.getMonth() - reminder.amount,
    1,
  );
  const year = targetMonthStart.getFullYear();
  const month = targetMonthStart.getMonth();
  const day = Math.min(occurrence.getDate(), lastDayOfMonth(year, month));

  return new Date(year, month, day, occurrence.getHours(), occurrence.getMinutes());
}

const SINGULAR: Record<ReminderUnit, string> = {
  minutos: 'minuto',
  horas: 'hora',
  dias: 'día',
  semanas: 'semana',
  meses: 'mes',
};

const PLURAL: Record<ReminderUnit, string> = {
  minutos: 'minutos',
  horas: 'horas',
  dias: 'días',
  semanas: 'semanas',
  meses: 'meses',
};

/** Etiqueta legible de un aviso: 'En el momento', '1 día antes', '3 semanas antes'. */
export function formatReminder(reminder: ReminderInput): string {
  if (reminder.amount === 0) return 'En el momento';
  const unit = reminder.amount === 1 ? SINGULAR[reminder.unit] : PLURAL[reminder.unit];
  return `${reminder.amount} ${unit} antes`;
}

/** Cuánta anticipación representa un aviso, para ordenarlos del más lejano al más cercano. */
export function reminderRank(reminder: ReminderInput): number {
  const perUnit: Record<ReminderUnit, number> = { ...MINUTES_PER_UNIT, meses: 60 * 24 * 30 };
  return reminder.amount * perUnit[reminder.unit];
}

/** Dos avisos son el mismo si coinciden en cantidad y unidad (0 minutos == 0 días: 'en el momento'). */
export function sameReminder(a: ReminderInput, b: ReminderInput): boolean {
  if (a.amount === 0 && b.amount === 0) return true;
  return a.amount === b.amount && a.unit === b.unit;
}
