import type { BuiltinEventType, EventTypeMeta, ReminderInput, ReminderUnit } from '@/types';

/**
 * Datos de los 5 tipos "de fábrica": la migración los siembra en la tabla
 * `event_types` una sola vez. De acá en más la fuente de verdad es la BD
 * (vía el slice `eventTypes`, ver constants/use-event-types.ts), no esta
 * constante — así el usuario puede editar label/ícono/color incluso de estos 5.
 */
export const DEFAULT_EVENT_TYPES: Record<
  BuiltinEventType,
  { label: string; icon: string; color: string; defaultYearly: boolean }
> = {
  evento: { label: 'Evento', icon: 'calendar', color: '#168BFF', defaultYearly: false },
  cumpleanos: { label: 'Cumpleaños', icon: 'gift', color: '#E91E63', defaultYearly: true },
  aniversario: { label: 'Aniversario', icon: 'heart', color: '#9C27B0', defaultYearly: true },
  festivo: { label: 'Día festivo', icon: 'sunny', color: '#FF9800', defaultYearly: true },
  cita_medica: { label: 'Cita médica', icon: 'medkit', color: '#4CAF50', defaultYearly: false },
};

/** Se usa si un evento quedó con una clave de tipo que ya no existe (no debería pasar, pero no debe romper la UI). */
export const FALLBACK_EVENT_TYPE_META: EventTypeMeta = {
  id: 0,
  key: '',
  label: 'Otro',
  icon: 'ellipse',
  color: '#999999',
  defaultYearly: false,
  isBuiltin: false,
};

/**
 * Atajos de anticipación que se ofrecen como chips. Además de estos, el
 * usuario puede armar cualquier aviso a medida (número + unidad).
 */
export const REMINDER_PRESETS: ReminderInput[] = [
  { amount: 0, unit: 'minutos' }, // en el momento
  { amount: 1, unit: 'horas' },
  { amount: 1, unit: 'dias' },
  { amount: 1, unit: 'semanas' },
  { amount: 1, unit: 'meses' },
];

/** Etiquetas de las unidades en el selector del aviso a medida. */
export const REMINDER_UNIT_LABELS: Record<ReminderUnit, string> = {
  minutos: 'minutos',
  horas: 'horas',
  dias: 'días',
  semanas: 'semanas',
  meses: 'meses',
};
