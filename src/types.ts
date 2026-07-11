/**
 * Tipos compartidos de toda la app.
 *
 * 💡 Aprendizaje: en React Native (igual que en Angular con sus interfaces)
 * conviene centralizar los modelos de datos en un solo lugar. Todo lo que
 * viaja entre la BD (SQLite), el estado global (Redux) y las pantallas
 * usa estos tipos.
 */

/** Los tipos de ítem que pediste: eventos, cumpleaños, aniversarios, festivos y citas médicas. */
export const EVENT_TYPES = ['evento', 'cumpleanos', 'aniversario', 'festivo', 'cita_medica'] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Un aviso programado de un evento. Un evento puede tener varios
 * (ej: 1 semana antes para comprar el regalo + el mismo día para saludar).
 */
export interface EventReminder {
  /** Minutos de anticipación respecto del evento (0 = en el momento). */
  minutes: number;
  /** Id de la notificación en el sistema, para cancelarla al editar/borrar (null si el entorno no soporta avisos). */
  notificationId: string | null;
}

export interface EventItem {
  id: number;
  title: string;
  type: EventType;
  /** Fecha en formato ISO 'YYYY-MM-DD' (se guarda como texto en SQLite). */
  date: string;
  /** Hora 'HH:mm', o null si es un evento de día completo (ej. un festivo). */
  time: string | null;
  description: string | null;
  /** Avisos programados (tabla `reminders`, 1 evento → N avisos). Vacío = sin recordatorio. */
  reminders: EventReminder[];
  /** 1 = se repite todos los años (cumpleaños, aniversarios, festivos). SQLite no tiene boolean. */
  yearly: 0 | 1;
}

/** Datos que completa el usuario al crear un evento: elige minutos; los ids de notificación los pone la app. */
export type NewEvent = Omit<EventItem, 'id' | 'reminders'> & { reminderMinutes: number[] };

export interface Note {
  id: number;
  title: string;
  content: string;
  /** Timestamps ISO completos, ej. '2026-07-11T14:30:00.000Z'. */
  createdAt: string;
  updatedAt: string;
}

export type NewNote = Pick<Note, 'title' | 'content'>;
