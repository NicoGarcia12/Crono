import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export type EventExecutor = Pick<SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

let writeTail: Promise<void> = Promise.resolve();

/** La unidad de trabajo es dueña de la transacción; sus helpers reciben solo el ejecutor. */
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
