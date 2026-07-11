import type { EventType } from '@/types';

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
 * Opciones de anticipación del recordatorio (se pueden elegir VARIAS por
 * evento, ej: 1 semana antes para el regalo + en el momento para saludar).
 */
export const REMINDER_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'En el momento', minutes: 0 },
  { label: '1 hora antes', minutes: 60 },
  { label: '1 día antes', minutes: 60 * 24 },
  { label: '1 semana antes', minutes: 60 * 24 * 7 },
];
