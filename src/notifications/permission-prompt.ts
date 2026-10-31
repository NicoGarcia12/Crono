import { notify } from '@/components/confirm';
import { requestNotificationPermission } from '@/notifications/notifications';

/**
 * Explicación + pedido del permiso de avisos, igual en la bienvenida
 * (NameSetup) y en la fila "Avisos" de Perfil (CRONO44).
 *
 * 💡 Aprendizaje: vive en un archivo aparte de `notifications.ts` a propósito.
 * Jest reemplaza módulos enteros (`jest.mock('@/notifications/notifications')`):
 * si este helper estuviera adentro, llamaría a la versión real de
 * `requestNotificationPermission` y los tests no podrían interceptarla.
 */

const EXPLAINER_TITLE = 'Avisos de tus eventos';
const EXPLAINER_MESSAGE =
  'Crono puede avisarte antes de un cumpleaños, una cita o lo que agendes, aunque la app esté cerrada y sin internet. ' +
  'Esos avisos dependen del permiso de notificaciones del sistema: ahora te lo va a pedir. ' +
  'Si no lo das, la app funciona igual pero sin avisos; podés activarlos después desde Perfil → Avisos.';

/**
 * Muestra el diálogo propio y, recién cuando se cierra, el pedido del sistema.
 * Devuelve true si el permiso quedó concedido. Nunca rechaza: un fallo del SO
 * al pedir el permiso se registra y cuenta como "sin permiso".
 */
export async function explainAndRequestNotificationPermission(): Promise<boolean> {
  await notify(EXPLAINER_TITLE, EXPLAINER_MESSAGE);
  try {
    return await requestNotificationPermission();
  } catch (error) {
    console.warn('No se pudo pedir el permiso de notificaciones', error);
    return false;
  }
}
