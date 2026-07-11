import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { NotificationContentInput } from 'expo-notifications';
import { Platform } from 'react-native';

import { EVENT_TYPE_META } from '@/constants/event-types';
import type { EventItem, NewEvent } from '@/types';
import { toLocalDate } from '@/utils/dates';

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

/** true si en este entorno se pueden programar recordatorios. */
export const remindersAvailable = !isExpoGoAndroid;

// Cache del módulo: undefined = todavía no se intentó cargar; null = no disponible.
let cachedModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;

  if (isExpoGoAndroid) {
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
 * Programa el recordatorio de un evento. Devuelve el id de la notificación
 * (para guardarlo en la BD y poder cancelarla después) o null si no corresponde
 * o el entorno no soporta notificaciones (Expo Go en Android).
 */
export async function scheduleEventReminder(event: NewEvent | EventItem): Promise<string | null> {
  const Notifications = getNotifications();
  if (!Notifications) return null;
  if (event.reminderMinutes === null) return null;

  const occurrence = toLocalDate(event.date, event.time ?? '09:00');
  // El aviso es X minutos ANTES del evento.
  const reminderAt = new Date(occurrence.getTime() - event.reminderMinutes * 60 * 1000);

  const content: NotificationContentInput = {
    title: `${EVENT_TYPE_META[event.type].label}: ${event.title}`,
    body: event.description ?? 'Tocá para ver el detalle en Crono.',
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

/** Cancela un recordatorio programado (al editar o borrar un evento). */
export async function cancelReminder(notificationId: string | null): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications || !notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
