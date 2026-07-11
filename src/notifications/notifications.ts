import * as Notifications from 'expo-notifications';
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
 */

/** Cómo se muestra una notificación si llega con la app ABIERTA (por defecto no se vería nada). */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Pide permiso al usuario (Android 13+ y iOS lo exigen). Devuelve true si lo dio. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // Android agrupa las notificaciones en "canales" configurables por el usuario.
    await Notifications.setNotificationChannelAsync('recordatorios', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Programa el recordatorio de un evento. Devuelve el id de la notificación
 * (para guardarlo en la BD y poder cancelarla después) o null si no corresponde.
 */
export async function scheduleEventReminder(event: NewEvent | EventItem): Promise<string | null> {
  if (event.reminderMinutes === null) return null;

  const occurrence = toLocalDate(event.date, event.time ?? '09:00');
  // El aviso es X minutos ANTES del evento.
  const reminderAt = new Date(occurrence.getTime() - event.reminderMinutes * 60 * 1000);

  const content: Notifications.NotificationContentInput = {
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
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
