import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export type EventExecutor = Pick<SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

let writeTail: Promise<void> = Promise.resolve();

/**
 * La unidad de trabajo es dueña de la transacción; sus helpers reciben solo el ejecutor.
 *
 * ATENCIÓN: en nativo el ejecutor es una conexión NUEVA (Expo `Transaction.createAsync`
 * abre otra con `useNewConnection: true`; ni el código nativo ni el wrapper JS ejecutan
 * `PRAGMA foreign_keys`) y SQLite arranca con las foreign keys APAGADAS. Dentro de la
 * transacción tampoco se pueden activar (el PRAGMA es un no-op con BEGIN abierto). Por lo
 * tanto ningún `ON DELETE CASCADE` / `SET NULL` ni chequeo de FK se dispara acá: todo
 * borrado que pase por esta función debe eliminar sus filas hijas de forma explícita
 * (ver `deleteEvent`). En web la conexión es la principal y sí tiene FK activas.
 */
export function withEventTransaction<T>(
  database: SQLiteDatabase,
  task: (transaction: EventExecutor) => Promise<T>,
): Promise<T> {
  // La cola vive en JS: evita BEGIN anidados entre guardados y permite reintentar
  // después de un rechazo. SQLite hace el commit/rollback en el hilo nativo/WASM.
  const pending = writeTail.then(async () => {
    let result!: T;
    if (Platform.OS === 'web') {
      // Expo 57 expone la API exclusiva en web, pero al invocarla lanza un error.
      await database.withTransactionAsync(async () => {
        result = await task(database);
      });
    } else {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        result = await task(transaction);
      });
    }
    return result;
  });
  writeTail = pending.then(() => undefined, () => undefined);
  return pending;
}
