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

export interface EventItem {
  id: number;
  title: string;
  type: EventType;
  /** Fecha en formato ISO 'YYYY-MM-DD' (se guarda como texto en SQLite). */
  date: string;
  /** Hora 'HH:mm', o null si es un evento de día completo (ej. un festivo). */
  time: string | null;
  description: string | null;
  /** Minutos de anticipación para el recordatorio; null = sin recordatorio. */
  reminderMinutes: number | null;
  /** 1 = se repite todos los años (cumpleaños, aniversarios, festivos). SQLite no tiene boolean. */
  yearly: 0 | 1;
  /** Id de la notificación programada en el sistema, para poder cancelarla al editar/borrar. */
  notificationId: string | null;
}

/** Datos que completa el usuario al crear un evento (el id y la notificación los pone la app). */
export type NewEvent = Omit<EventItem, 'id' | 'notificationId'>;

export interface Note {
  id: number;
  title: string;
  content: string;
  /** Timestamps ISO completos, ej. '2026-07-11T14:30:00.000Z'. */
  createdAt: string;
  updatedAt: string;
}

export type NewNote = Pick<Note, 'title' | 'content'>;
