import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * El selector devuelve una URI temporal: elegir o cancelar un borrador NO crea
 * una copia persistente. La copia se hace al guardar, dentro de la unidad de
 * trabajo de `@/db/photos-repo`; SQLite publica la URI sólo cuando la copia terminó.
 * Este módulo nunca borra ni mueve archivos que no sean copias propias de /photos.
 */
export type PhotoPrefix = 'evento' | 'perfil';

/** Nombres que genera `savePhoto` (incluye los de versiones anteriores, sin contador). */
const OWN_PHOTO_NAME = /^(evento|perfil)-\d+(?:-\d+)?\.[a-zA-Z0-9]+$/;

let nextPhotoId = 0;

function getPhotosDir(): Directory {
  // Paths.document es nativo: resolverlo al ejecutar, nunca al importar en web.
  return new Directory(Paths.document, 'photos');
}

/** Abre el selector sin modificar fotos ni referencias existentes. */
export async function pickPhoto(): Promise<string | null> {
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

  return result.assets[0].uri;
}

/** Último segmento de una URI: la identidad de una copia propia, con o sin el prefijo actual del sandbox. */
export function photoFileName(uri: string): string {
  return uri.slice(uri.lastIndexOf('/') + 1);
}

/** Sólo reconocemos copias generadas por Crono, directamente en su carpeta. */
export function isSavedPhoto(uri: string): boolean {
  if (Platform.OS === 'web') return false;
  const directoryUri = getPhotosDir().uri;
  const prefix = directoryUri.endsWith('/') ? directoryUri : `${directoryUri}/`;
  return uri.startsWith(prefix) && OWN_PHOTO_NAME.test(uri.slice(prefix.length));
}

/**
 * Devuelve una URI persistente. Una copia propia ya guardada se reutiliza tal cual
 * (puede estar compartida por varias referencias); cualquier otra se copia.
 * La fuente —galería o caché del selector— jamás se mueve ni se borra.
 */
export async function savePhoto(sourceUri: string, prefix: PhotoPrefix): Promise<string> {
  if (Platform.OS === 'web') throw new Error('Las fotos están disponibles en la app instalada.');
  if (isSavedPhoto(sourceUri)) return sourceUri;

  const source = new File(sourceUri);
  const directory = getPhotosDir();
  if (!directory.exists) directory.create({ intermediates: true });
  const extension = /^\.[a-zA-Z0-9]+$/.test(source.extension) ? source.extension : '.jpg';
  let destination: File;
  do {
    destination = new File(directory, `${prefix}-${Date.now()}-${nextPhotoId++}${extension}`);
  } while (destination.exists);
  // En SDK 57 `copy` es ASYNC: sin await se publicaría una URI antes de que exista el archivo.
  // Si rechaza puede quedar una copia parcial: el repositorio la limpia al no tener referencias.
  await source.copy(destination);
  return destination.uri;
}

/** Inventario acotado: no recorremos subcarpetas ni tocamos archivos externos. */
export function savedPhotos(): File[] {
  if (Platform.OS === 'web') return [];
  const directory = getPhotosDir();
  if (!directory.exists) return [];
  return directory.list().filter((entry): entry is File => entry instanceof File && isSavedPhoto(entry.uri));
}

/** Borra una copia propia. El repositorio debe comprobar referencias antes de invocarlo. */
export function deletePhoto(uri: string): void {
  if (!isSavedPhoto(uri)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
