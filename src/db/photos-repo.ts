import { errorMessage, notify } from '@/components/confirm';
import { getDb } from '@/db/database';
import { withEventTransaction, type EventExecutor } from '@/db/event-transaction';
import { deletePhoto, photoFileName, savePhoto, savedPhotos, type PhotoPrefix } from '@/media/photos';
import { writeSetting } from '@/db/settings-repo';

/**
 * Las referencias válidas a una foto propia viven en SQLite: `events.photo_uri` y el
 * setting `photoUri` del perfil (regalos y notas no guardan fotos). Sobreviven al
 * reinicio, así que no hay contadores ni listas en memoria. Copiar, publicar la
 * referencia y limpiar comparten la cola de escrituras de eventos/backup.
 */

/** Convierte la foto elegida en una URI persistente; `null` (sin foto) no toca el disco. */
export async function persistPhoto(uri: string | null, prefix: PhotoPrefix): Promise<string | null> {
  return uri === null ? null : savePhoto(uri, prefix);
}

/**
 * Borra las copias de /photos que ninguna fila referencia. La identidad es el nombre
 * (único por timestamp y contador): si la ruta absoluta guardada cambió, el archivo
 * se conserva. Nunca toca la galería ni nada fuera de /photos.
 *
 * El inventario se toma antes de entrar en la cola: una copia en curso se hace dentro
 * de la cola, así que no puede aparecer sin referencia durante esta consulta.
 */
export async function cleanupUnusedPhotos(): Promise<void> {
  const candidates = savedPhotos();
  if (candidates.length === 0) return;

  await withEventTransaction(getDb(), async (db) => {
    const rows = await db.getAllAsync<{ uri: string }>(
      `SELECT photo_uri AS uri FROM events WHERE photo_uri IS NOT NULL
       UNION SELECT value AS uri FROM settings WHERE key = 'photoUri' AND value != ''`,
    );
    const referenced = new Set(rows.map(({ uri }) => photoFileName(uri)));
    const failures: unknown[] = [];
    for (const file of candidates) {
      if (referenced.has(photoFileName(file.uri))) continue;
      try {
        deletePhoto(file.uri);
      } catch (error: unknown) {
        failures.push(error);
      }
    }
    if (failures.length > 0) {
      throw new Error(`No se pudieron borrar ${failures.length} copias sin uso: ${failures.map(errorMessage).join('; ')}`);
    }
  });
}

/** Un fallo de limpieza NO transforma un commit exitoso en un guardado fallido: se avisa y se reintenta luego. */
export async function cleanupPhotosWithNotice(): Promise<void> {
  try {
    await cleanupUnusedPhotos();
  } catch (error: unknown) {
    notify(
      'Fotos sin usar pendientes de borrar',
      `Tus datos y fotos guardados no se modificaron. ${errorMessage(error)}. Se reintentará al abrir la app o al guardar otra foto.`,
    );
  }
}

/**
 * Unidad de trabajo para todo lo que pueda crear, reemplazar o dejar sin referencia una
 * foto. Tras commit o rollback se limpian los archivos sin referencia: la foto anterior
 * reemplazada/quitada, la del evento borrado y los restos de una copia fallida.
 * Si la app se interrumpe entre ambos pasos, el próximo arranque hace lo mismo.
 */
export async function withPhotoTransaction<T>(
  task: (db: EventExecutor) => Promise<T>,
  connection: 'exclusive' | 'primary' = 'exclusive',
): Promise<T> {
  try {
    return await withEventTransaction(getDb(), task, connection);
  } finally {
    await cleanupPhotosWithNotice();
  }
}

/**
 * Cambia o quita la foto de perfil. Si copiar falla, la transacción hace rollback y el
 * setting anterior sigue apuntando a su archivo. Devuelve la URI persistida.
 */
export function saveProfilePhoto(selectedUri: string | null): Promise<string | null> {
  return withPhotoTransaction(async (db) => {
    const photoUri = await persistPhoto(selectedUri, 'perfil');
    await writeSetting(db, 'photoUri', photoUri ?? '');
    return photoUri;
  }, 'primary');
}
