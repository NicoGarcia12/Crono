import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Guardar y elegir archivos en el celular.
 *
 * 💡 Aprendizaje: una app no puede escribir donde quiera en el teléfono. Lo que
 * hace es escribir en su propia carpeta (sandbox) y después abrir la hoja de
 * "Compartir" del sistema, donde el usuario elige a dónde mandarlo (Drive,
 * WhatsApp, Archivos…). Este archivo tiene un hermano `file-io.web.ts` con la
 * versión de navegador — Metro elige la que corresponde.
 */

/** Escribe el contenido en un archivo temporal y abre la hoja de Compartir. */
export async function saveAndShare(fileName: string, content: string): Promise<void> {
  const file = new File(new Directory(Paths.cache), fileName);
  if (file.exists) file.delete(); // por si ya se exportó hoy
  file.create();
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Guardar copia de seguridad de Crono',
    });
  }
}

/**
 * Abre el explorador de archivos y devuelve el texto del archivo elegido (null si canceló).
 *
 * Se usa el selector de expo-file-system y no expo-document-picker: en Android
 * (sobre todo en Expo Go) la copia que hace DocumentPicker queda fuera de las
 * carpetas que File puede leer y `text()` falla con "Missing 'READ' permission".
 * Este selector devuelve un File que sí se puede leer (content:// en Android).
 */
export async function pickTextFile(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: 'application/json' });
  if (picked.canceled) return null;

  return picked.result.text();
}
