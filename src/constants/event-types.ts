import type { EventType, ReminderInput, ReminderUnit } from '@/types';

/**
 * Metadatos de presentación por tipo de evento: etiqueta en español,
 * ícono (de Ionicons, que viene incluido con Expo) y color distintivo.
 */
interface EventTypeMeta {
  label: string;
  /** Nombre de ícono de Ionicons (https://icons.expo.fyi). */
  icon: string;
  color: string;
  /** Si por defecto se repite cada año al crear un evento de este tipo. */
  defaultYearly: boolean;
}

export const EVENT_TYPE_META: Record<EventType, EventTypeMeta> = {
  evento: { label: 'Evento', icon: 'calendar', color: '#208AEF', defaultYearly: false },
  cumpleanos: { label: 'Cumpleaños', icon: 'gift', color: '#E91E63', defaultYearly: true },
  aniversario: { label: 'Aniversario', icon: 'heart', color: '#9C27B0', defaultYearly: true },
  festivo: { label: 'Día festivo', icon: 'sunny', color: '#FF9800', defaultYearly: true },
  cita_medica: { label: 'Cita médica', icon: 'medkit', color: '#4CAF50', defaultYearly: false },
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
