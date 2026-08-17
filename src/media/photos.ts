import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Fotos de eventos y de perfil.
 *
 * 💡 Aprendizaje: `expo-image-picker` devuelve una URI temporal (a veces en
 * caché, que el sistema puede borrar). Para que la foto sobreviva un reinicio
 * de la app hay que copiarla a `Paths.document` — el mismo sandbox donde vive
 * la base SQLite — y guardar ESA ruta, no la original.
 */

const photosDir = new Directory(Paths.document, 'photos');

function ensurePhotosDir(): void {
  if (!photosDir.exists) photosDir.create({ intermediates: true });
}

/**
 * Abre el selector de imágenes (pide permiso recién acá) y devuelve la
 * elegida ya copiada a almacenamiento persistente. `null` si canceló o no
 * dio el permiso — no hay entorno web que soporte esto (no hay picker nativo).
 */
export async function pickAndSavePhoto(prefix: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;

  return savePhoto(result.assets[0].uri, prefix);
}

/** Copia una imagen (de donde sea) al sandbox de la app, con nombre único. */
export function savePhoto(sourceUri: string, prefix: string): string {
  ensurePhotosDir();
  const source = new File(sourceUri);
  const extension = source.extension || '.jpg';
  const destination = new File(photosDir, `${prefix}-${Date.now()}${extension}`);
  source.copy(destination);
  return destination.uri;
}

/** Borra una foto guardada. Silencioso si ya no existe — nunca rompe el flujo de guardar. */
export function deletePhoto(uri: string): void {
  const file = new File(uri);
  if (file.exists) file.delete();
}
