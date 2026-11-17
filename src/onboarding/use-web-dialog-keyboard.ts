import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Lo que el navegador deja enfocar con Tab (react-native-web pone `tabindex="0"` en los Pressable). */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Teclado de un diálogo propio en web (CRONO44): Escape lo cierra y Tab /
 * Shift+Tab dan la vuelta dentro de él en vez de salir.
 *
 * 💡 Aprendizaje: `inert` en el contenido de abajo lo saca del orden de Tab,
 * pero no alcanza: desde el último botón del diálogo, Tab sigue de largo hacia
 * la barra del navegador. Por eso hace falta una "trampa de foco": interceptar
 * Tab y mover el foco a mano entre los elementos del propio diálogo.
 *
 * En Android/iOS no hace nada: no hay teclado de Tab ni `document`; ahí el
 * overlay ya bloquea los toques y los lectores quedan dentro con
 * `accessibilityViewIsModal` / `importantForAccessibility`.
 *
 * @param dialogId `nativeID` del diálogo (react-native-web lo publica como `id`).
 */
export function useWebDialogKeyboard(dialogId: string, enabled: boolean, onEscape: () => void): void {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const dialog = document.getElementById(dialogId);
      if (!dialog) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      event.preventDefault();

      const current = focusables.findIndex((element) => element === document.activeElement);
      const last = focusables.length - 1;
      let next: number;
      if (current === -1) next = event.shiftKey ? last : 0;
      else if (event.shiftKey) next = current === 0 ? last : current - 1;
      else next = current === last ? 0 : current + 1;
      focusables[next]?.focus();
    };

    // Fase de captura: el diálogo decide antes que cualquier otro manejador de la página.
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [dialogId, enabled, onEscape]);
}
