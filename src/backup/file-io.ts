import * as DocumentPicker from 'expo-document-picker';
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

/** Abre el explorador de archivos y devuelve el texto del archivo elegido (null si canceló). */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;

  return new File(asset.uri).text();
}
