/**
 * Texto único para la UI (diálogo de error) y el log cuando el usuario intenta
 * importar contactos donde no hay agenda del sistema (web). No menciona la
 * plataforma: la pantalla es la misma que en el celular.
 *
 * 💡 Aprendizaje: vive en su propio módulo, sin importar `expo-contacts`, para
 * que Perfil pueda mostrarlo sin arrastrar el módulo nativo (que en Jest hay que
 * mockear y en web ni siquiera existe) a cada pantalla que lo nombra.
 */
export const CONTACTS_UNAVAILABLE_MESSAGE = 'Importar contactos no está disponible en esta versión.';
