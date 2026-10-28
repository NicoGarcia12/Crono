import { getDb } from '@/db/database';
import type { EventExecutor } from '@/db/event-transaction';

/**
 * Preferencias simples en formato clave-valor.
 * Hoy solo guarda el nombre del usuario; queda lista para más adelante
 * (tema, hora por defecto de recordatorios, etc.).
 */

export async function getSetting(key: string, db: Pick<EventExecutor, 'getFirstAsync'> = getDb()): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  // UPSERT: inserta o actualiza si la clave ya existe.
  await getDb().runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    key,
    value,
  );
}
