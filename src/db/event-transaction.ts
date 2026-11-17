import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export type EventExecutor = Pick<SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;

let writeTail: Promise<void> = Promise.resolve();

/**
 * La unidad de trabajo es dueña de la transacción; sus helpers reciben solo el ejecutor.
 *
 * Por defecto, en nativo el ejecutor es una conexión NUEVA (Expo `Transaction.createAsync`
 * abre otra con `useNewConnection: true`, sin activar `PRAGMA foreign_keys`). SQLite
 * arranca allí sin CASCADE/SET NULL ni chequeos FK; los borrados de eventos eliminan
 * explícitamente sus hijos. `primary` conserva las FK de initDatabase para unidades
 * que dependen de cascadas, usando la MISMA cola. En web siempre se usa la principal.
 * Ningún helper debe abrir otra transacción ni volver a entrar en esta cola.
 */
export function withEventTransaction<T>(
  database: SQLiteDatabase,
  task: (transaction: EventExecutor) => Promise<T>,
  connection: 'exclusive' | 'primary' = 'exclusive',
): Promise<T> {
  // La cola vive en JS: evita BEGIN anidados entre guardados y permite reintentar
  // después de un rechazo. SQLite hace el commit/rollback en el hilo nativo/WASM.
  const pending = writeTail.then(async () => {
    let result!: T;
    if (Platform.OS === 'web' || connection === 'primary') {
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
