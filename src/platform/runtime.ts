import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { showError } from '@/components/confirm';

/**
 * Entorno de ejecución y capacidades disponibles.
 *
 * 💡 Aprendizaje: el mismo bundle de Crono corre en tres lugares distintos:
 *  - `web`: el navegador (react-native-web). No hay módulos nativos: ni agenda
 *    de contactos, ni sandbox de archivos, ni credencial del sistema.
 *  - `expo-go`: la app Expo Go de la tienda, que trae un conjunto fijo de
 *    módulos nativos. `Constants.executionEnvironment === StoreClient`.
 *  - `native`: development build o APK/IPA propio (Standalone / Bare).
 *
 * Toda diferencia "acá esto no se puede" pasa por acá: la detección vive en un
 * solo lugar y el aviso tiene dos sabores según cómo surge (ver abajo). La UI no
 * cambia por entorno: los mensajes no dicen "web" ni "Expo Go"; esa causa va
 * sólo al log, junto con `runtime.kind`.
 *
 * Este módulo no importa nada nativo (sólo `react-native` y `expo-constants`),
 * así cualquier pantalla puede consultarlo sin arrastrar módulos que en Jest
 * hay que mockear y en web ni existen.
 */

export type RuntimeKind = 'web' | 'expo-go' | 'native';

/** Capacidades que algún entorno no cumple. El orden es el del log de arranque. */
export const RUNTIME_CAPABILITIES = ['reminders', 'contacts', 'photos', 'localLock'] as const;
export type RuntimeCapability = (typeof RUNTIME_CAPABILITIES)[number];

interface RuntimeInfo {
  readonly kind: RuntimeKind;
  readonly os: typeof Platform.OS;
}

/**
 * Getters y no valores fijos: en producción `Platform.OS` no cambia, pero los
 * tests lo reasignan por caso (`Platform.OS = 'web'`) y un valor calculado al
 * importar el módulo ignoraría ese cambio. El costo de releer es nulo.
 */
export const runtime: RuntimeInfo = {
  get kind(): RuntimeKind {
    if (Platform.OS === 'web') return 'web';
    return Constants.executionEnvironment === ExecutionEnvironment.StoreClient ? 'expo-go' : 'native';
  },
  get os(): typeof Platform.OS {
    return Platform.OS;
  },
};

interface CapabilityRule {
  /** Texto para el usuario y el log. Sin nombrar la plataforma: la pantalla es la misma en todas. */
  readonly message: string;
  readonly available: (info: RuntimeInfo) => boolean;
}

const notOnWeb = (info: RuntimeInfo): boolean => info.kind !== 'web';

const RULES: Readonly<Record<RuntimeCapability, CapabilityRule>> = {
  // Restricción de Crono, no del SDK: SDK 57 admite notificaciones locales en
  // Expo Go; sólo el push remoto requiere development build. Web no tiene el
  // scheduler nativo de expo-notifications.
  reminders: {
    message: 'Esta versión no programa recordatorios.',
    available: (info) => info.kind !== 'web' && !(info.kind === 'expo-go' && info.os === 'android'),
  },
  contacts: {
    message: 'Importar contactos no está disponible en esta versión.',
    available: notOnWeb,
  },
  photos: {
    message: 'Elegir una foto no está disponible en esta versión.',
    available: notOnWeb,
  },
  localLock: {
    message: 'El bloqueo local no está disponible en esta versión.',
    available: notOnWeb,
  },
};

/** true si en este entorno la capacidad funciona. */
export function isAvailable(capability: RuntimeCapability): boolean {
  return RULES[capability].available(runtime);
}

/** Texto único de "no disponible", para quien necesita mostrarlo o rechazar con él. */
export function unavailableMessage(capability: RuntimeCapability): string {
  return RULES[capability].message;
}

/**
 * Diferencia pasiva (no surge de una acción del usuario: arranque, carga de una
 * pantalla): sólo consola. El segundo argumento es contexto para quien lee el
 * log; el mensaje queda idéntico al que vería el usuario en `reportUnavailable`.
 */
export function logUnavailable(capability: RuntimeCapability): void {
  console.warn(unavailableMessage(capability), { capability, runtime: runtime.kind });
}

/**
 * Diferencia por acción del usuario (tocó un botón que acá no se puede cumplir):
 * consola + diálogo de error. El botón se mantiene igual en todos los entornos;
 * lo que cambia es la respuesta al tocarlo.
 */
export function reportUnavailable(capability: RuntimeCapability, title: string): void {
  logUnavailable(capability);
  showError(title, unavailableMessage(capability));
}
