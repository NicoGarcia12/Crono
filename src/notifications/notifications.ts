import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { NotificationContentInput } from 'expo-notifications';
import { Platform } from 'react-native';

import { REMINDER_UNIT_LABELS } from '@/constants/event-types';
import type { EventReminder, NewEvent, ReminderInput, ReminderUnit } from '@/types';
import { toLocalDate } from '@/utils/dates';
import { reminderDate } from '@/utils/reminders';

/**
 * Recordatorios con notificaciones LOCALES.
 *
 * 💡 Aprendizaje: hay dos tipos de notificaciones en mobile:
 *  - Push: las manda un servidor por internet (acá no aplica, no hay servidor).
 *  - Locales: la propia app le pide al sistema operativo "avisame a tal hora".
 *    Funcionan sin conexión y aunque la app esté cerrada. Son las que usamos.
 *
 * ⚠️ Limitación de Expo Go en Android (SDK 53+): el módulo expo-notifications
 * lanza un error apenas se importa, porque intenta registrar push tokens
 * (funcionalidad quitada de Expo Go). Por eso acá NO lo importamos arriba del
 * archivo: lo cargamos de forma diferida con require() y lo salteamos por
 * completo cuando corremos dentro de Expo Go en Android. En la app instalada
 * de verdad (development build / APK) los recordatorios funcionan normal.
 */

type NotificationsModule = typeof import('expo-notifications');

/** ExecutionEnvironment.StoreClient === corriendo dentro de Expo Go. */
const isExpoGoAndroid =
  Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Entornos sin notificaciones programadas: Expo Go Android (push removido en
 * SDK 53+) y web (el navegador no tiene el scheduler nativo de expo-notifications).
 */
const notificationsUnavailable = isExpoGoAndroid || Platform.OS === 'web';

/** true si en este entorno se pueden programar recordatorios. */
export const remindersAvailable = !notificationsUnavailable;

/**
 * Un vistazo con onda al tipo de evento, para el título de la notificación.
 * Solo cubre los 5 de fábrica: los tipos personalizados (no tienen emoji
 * propio) caen en el genérico — no vale la pena pedirle un emoji al usuario
 * al crear un tipo nuevo.
 */
const EVENT_TYPE_EMOJI: Record<string, string> = {
  evento: '📅',
  cumpleanos: '🎂',
  aniversario: '💞',
  festivo: '🎉',
  cita_medica: '🩺',
};
const FALLBACK_EMOJI = '📌';

const REMINDER_UNIT_SINGULAR: Record<ReminderUnit, string> = {
  minutos: 'minuto',
  horas: 'hora',
  dias: 'día',
  semanas: 'semana',
  meses: 'mes',
};

/** Frase humana según la anticipación elegida: "Es mañana", "Es en 3 días"... */
function friendlyLeadIn(reminder: ReminderInput): string {
  if (reminder.amount === 0) return 'Es ahora mismo';
  if (reminder.unit === 'dias' && reminder.amount === 1) return 'Es mañana';
  const unitLabel =
    reminder.amount === 1 ? REMINDER_UNIT_SINGULAR[reminder.unit] : REMINDER_UNIT_LABELS[reminder.unit];
  return `Es en ${reminder.amount} ${unitLabel}`;
}

// Cache del módulo: undefined = todavía no se intentó cargar; null = no disponible.
let cachedModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;

  if (notificationsUnavailable) {
    cachedModule = null;
    return cachedModule;
  }

  // require() dinámico: el módulo recién se evalúa acá (no al arrancar la app).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Notifications = require('expo-notifications') as NotificationsModule;

  // Cómo se muestra una notificación si llega con la app ABIERTA (por defecto no se vería nada).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  cachedModule = Notifications;
  return cachedModule;
}

/** Pide permiso al usuario (Android 13+ y iOS lo exigen). Devuelve true si lo dio. */
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  if (Platform.OS === 'android') {
    // Android agrupa las notificaciones en "canales" configurables por el usuario.
    await Notifications.setNotificationChannelAsync('recordatorios', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Programa TODOS los avisos de un evento (uno por cada anticipación elegida)
 * y devuelve la lista con sus ids de notificación, lista para persistir.
 * En entornos sin notificaciones, los ids quedan en null.
 */
export async function scheduleEventReminders(event: NewEvent): Promise<EventReminder[]> {
  const scheduled: EventReminder[] = [];
  try {
    for (const reminder of event.reminders) {
      scheduled.push({ ...reminder, notificationId: await scheduleOne(event, reminder) });
    }
    return scheduled;
  } catch (error) {
    /**
     * `scheduleNotificationAsync` cruza el límite JS → sistema operativo: no
     * participa de una transacción SQLite. Si el segundo aviso falla, por
     * ejemplo, debemos deshacer manualmente los IDs que el SO ya aceptó.
     *
     * `allSettled` hace la compensación "best effort": un error al cancelar
     * un aviso no tapa el error original que explica por qué no se pudo crear
     * el conjunto completo.
     */
    const Notifications = getNotifications();
    const cancellationAttempts = scheduled
      .flatMap(({ notificationId }) => (notificationId ? [notificationId] : []))
      .map((notificationId) => Notifications?.cancelScheduledNotificationAsync(notificationId));

    await Promise.allSettled(cancellationAttempts);
    throw error;
  }
}

/**
 * Programa un aviso puntual. Devuelve el id de la notificación (para poder
 * cancelarla después) o null si no corresponde o el entorno no soporta
 * notificaciones (Expo Go en Android, web).
 */
async function scheduleOne(event: NewEvent, reminder: ReminderInput): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) return null;

  const occurrence = toLocalDate(event.date, event.time ?? '09:00');
  // Momento del aviso: la fecha del evento menos la anticipación elegida
  // (los meses se restan por calendario, ver utils/reminders).
  const reminderAt = reminderDate(occurrence, reminder);

  const content: NotificationContentInput = {
    title: `${EVENT_TYPE_EMOJI[event.type] ?? FALLBACK_EMOJI} ${event.title}`,
    body: event.description
      ? `${friendlyLeadIn(reminder)}. ${event.description}`
      : `${friendlyLeadIn(reminder)}. Tocá para ver el detalle en Crono.`,
    sound: 'default',
  };

  if (event.yearly) {
    // Trigger YEARLY: el sistema repite el aviso cada año en ese día/mes/hora.
    return Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.YEARLY,
        month: reminderAt.getMonth() + 1, // expo-notifications usa meses 1-12
        day: reminderAt.getDate(),
        hour: reminderAt.getHours(),
        minute: reminderAt.getMinutes(),
        channelId: 'recordatorios',
      },
    });
  }

  // Evento puntual: si el momento del aviso ya pasó, no programamos nada.
  if (reminderAt.getTime() <= Date.now()) return null;

  return Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: reminderAt,
      channelId: 'recordatorios',
    },
  });
}

/** Cancela los avisos programados de un evento (al editarlo o borrarlo). */
export async function cancelReminders(reminders: EventReminder[]): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  // Cada cancelación cruza JS → SO y puede fallar de forma independiente. No
  // usamos un `for await`: si la primera falla, los avisos siguientes quedarían
  // huérfanos. `allSettled` intenta limpiar todos y después conserva el error
  // para que editar/borrar no informe un éxito que no ocurrió completamente.
  const results = await Promise.allSettled(
    reminders.flatMap(({ notificationId }) =>
      notificationId ? [Notifications.cancelScheduledNotificationAsync(notificationId)] : [],
    ),
  );
  const failedCancellation = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failedCancellation) {
    throw failedCancellation.reason;
  }
}
