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

/** Unidades en las que se puede expresar la anticipación de un aviso. */
export const REMINDER_UNITS = ['minutos', 'horas', 'dias', 'semanas', 'meses'] as const;

export type ReminderUnit = (typeof REMINDER_UNITS)[number];

/** Anticipación elegida por el usuario: "3 días antes" = { amount: 3, unit: 'dias' }. */
export interface ReminderInput {
  /** 0 = en el momento del evento. */
  amount: number;
  unit: ReminderUnit;
}

/**
 * Un aviso programado de un evento. Un evento puede tener varios
 * (ej: 1 mes antes para el regalo + 1 hora antes para no llegar tarde).
 */
export interface EventReminder extends ReminderInput {
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
  /** Id del contacto del celular del que salió este evento (null si se cargó a mano). */
  contactId: string | null;
  /** Teléfono del contacto, para saludarlo por WhatsApp sin buscarlo. */
  phone: string | null;
  /** Avisos programados (tabla `reminders`, 1 evento → N avisos). Vacío = sin recordatorio. */
  reminders: EventReminder[];
  /** 1 = se repite todos los años (cumpleaños, aniversarios, festivos). SQLite no tiene boolean. */
  yearly: 0 | 1;
  /** 1 = este es MI cumpleaños (habilita la lista de quién me saludó). Solo uno puede serlo. */
  isMine: 0 | 1;
}

/**
 * Una persona en la lista de "quién me saludó" de un año.
 * Puede ser alguien cuyo cumpleaños tengo cargado (eventId) o alguien que
 * anoté a mano en la lista (eventId null).
 */
export interface Greeting {
  id: number;
  /** Año del saludo: la lista se reinicia sola cada año. */
  year: number;
  /** Evento de cumpleaños de esa persona, si lo tengo en la agenda. */
  eventId: number | null;
  name: string;
  phone: string | null;
  greeted: 0 | 1;
}

/** Datos que completa el usuario al crear un evento: elige las anticipaciones; los ids de notificación los pone la app. */
export type NewEvent = Omit<EventItem, 'id' | 'reminders'> & { reminders: ReminderInput[] };

/**
 * Regla de dominio: el cumpleaños de la persona dueña de la agenda siempre
 * es de tipo cumpleaños y se repite anualmente, incluso fuera del formulario.
 */
export function enforceMineBirthday(event: NewEvent): NewEvent {
  return event.isMine === 1 ? { ...event, type: 'cumpleanos', yearly: 1 } : event;
}

export interface Note {
  id: number;
  title: string;
  content: string;
  /** Timestamps ISO completos, ej. '2026-07-11T14:30:00.000Z'. */
  createdAt: string;
  updatedAt: string;
}

export type NewNote = Pick<Note, 'title' | 'content'>;

/**
 * Una idea de regalo anotada para la persona de un evento. Lista libre, sin
 * checklist: cuando se le da el regalo, la idea se saca (no queda historial).
 */
export interface GiftIdea {
  id: number;
  eventId: number;
  text: string;
  createdAt: string;
}

export type NewGiftIdea = Pick<GiftIdea, 'eventId' | 'text'>;

/**
 * Marca de "ya lo saludé" para un cumpleaños/aniversario ajeno, año por año
 * (mismo patrón no destructivo que `Greeting`: al pasar de año se crea una
 * fila nueva, nunca se borran las anteriores).
 */
export interface GreetingSent {
  id: number;
  year: number;
  eventId: number;
  greeted: 0 | 1;
}
