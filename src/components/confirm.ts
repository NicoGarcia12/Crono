/**
 * Diálogos propios de Crono (confirmaciones y avisos) con los estilos de la app.
 *
 * 💡 Aprendizaje: estas funciones se llaman desde handlers, fuera de React, así
 * que no pueden renderizar nada. Encolan un pedido en un store chiquito y
 * `<DialogHost />` (montado una sola vez en el layout raíz) lo muestra con un
 * `Modal`. La Promise se resuelve cuando la persona toca un botón.
 *
 * Reemplaza a `Alert.alert` (que en react-native-web no muestra nada) y al
 * `confirm`/`alert` del navegador: el diálogo es el mismo en Android, iOS y web.
 */

export type DialogButtonStyle = 'cancel' | 'default' | 'destructive';

export interface DialogButton {
  label: string;
  style: DialogButtonStyle;
  /** Con qué valor se resuelve la Promise al tocarlo. */
  value: boolean;
}

export interface DialogRequest {
  id: number;
  title: string;
  message: string;
  buttons: DialogButton[];
}

interface PendingDialog extends DialogRequest {
  resolve: (value: boolean) => void;
}

let queue: PendingDialog[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function showDialog(title: string, message: string, buttons: DialogButton[]): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { id: nextId++, title, message, buttons, resolve }];
    emit();
  });
}

/** Para `useSyncExternalStore`: avisa cuando cambia el diálogo visible. */
export function subscribeDialogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** El diálogo que se ve ahora (los demás esperan su turno). */
export function currentDialog(): DialogRequest | null {
  return queue[0] ?? null;
}

/** Cierra el diálogo `id` resolviendo su Promise con `value`. */
export function resolveDialog(id: number, value: boolean): void {
  const dialog = queue.find((d) => d.id === id);
  if (!dialog) return;
  queue = queue.filter((d) => d.id !== id);
  dialog.resolve(value);
  emit();
}

/** Confirmación destructiva (borrar): el botón de confirmar se ve en rojo. */
export function confirmDestructive(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return showDialog(title, message, [
    { label: 'Cancelar', style: 'cancel', value: false },
    { label: confirmLabel, style: 'destructive', value: true },
  ]);
}

/** Pregunta sí/no que no borra nada (ej. "¿querés cargar el dato nuevo?"). */
export function confirmAction(title: string, message: string, confirmLabel: string, cancelLabel = 'Ahora no'): Promise<boolean> {
  return showDialog(title, message, [
    { label: cancelLabel, style: 'cancel', value: false },
    { label: confirmLabel, style: 'default', value: true },
  ]);
}

/**
 * Aviso informativo con un solo botón. La Promise se resuelve al cerrarlo, así
 * quien necesite seguir recién después (ej. pedir un permiso) puede `await`-earla;
 * quien no, la ignora con `void`.
 */
export async function notify(title: string, message: string): Promise<void> {
  await showDialog(title, message, [{ label: 'Entendido', style: 'default', value: true }]);
}

/**
 * Texto legible de un error. Los thunks rechazados (`.unwrap()`) no tiran un
 * `Error` sino un objeto plano con `message`, así que se contemplan los dos.
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}

/** Avisa que algo falló, igual en el celular y en web. */
export function showError(title: string, error: unknown): void {
  void notify(title, errorMessage(error));
}

/** "Afecta a 3 eventos: 3 ideas de regalo y 2 valores de «Obra social»." */
export function impactMessage(impact: { events: number; items: { label: string; count: number }[] }): string {
  const parts = impact.items.map((item) => `${item.count} ${item.label}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}` : parts[0];
  const events = `${impact.events} ${impact.events === 1 ? 'evento' : 'eventos'}`;
  return `Afecta a ${events}: se borran ${list}. No se puede deshacer.`;
}
