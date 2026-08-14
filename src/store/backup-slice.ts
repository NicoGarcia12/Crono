import { createAsyncThunk } from '@reduxjs/toolkit';

import { backupFileName, buildBackup, itemsToRestore, parseBackup, serializeBackup } from '@/backup/backup';
import { pickTextFile, saveAndShare } from '@/backup/file-io';
import * as greetingsRepo from '@/db/greetings-repo';
import { addEvent } from '@/store/events-slice';
import { addNote } from '@/store/notes-slice';
import type { RootState } from '@/store';

/**
 * Exportar / restaurar la copia de seguridad.
 *
 * 💡 Aprendizaje: estos thunks NO tocan la BD directamente: reusan los thunks
 * que ya existen (addEvent programa los recordatorios, addNote persiste la nota).
 * Así la restauración deja el mismo estado que si hubieras cargado todo a mano.
 */

/** Exporta todo a un archivo y abre la hoja de Compartir (o lo descarga, en web). */
export const exportBackup = createAsyncThunk('backup/export', async (_: void, { getState }) => {
  const state = getState() as RootState;
  const backup = buildBackup(
    state.events.items,
    state.notes.items,
    state.settings.displayName,
    undefined,
    state.greetings.items,
  );

  await saveAndShare(backupFileName(), serializeBackup(backup));

  return { events: backup.events.length, notes: backup.notes.length };
});

export interface RestoreSummary {
  /** Cuántos se agregaron. */
  events: number;
  notes: number;
  /** Cuántos ya estaban y se saltearon (no se duplican). */
  skipped: number;
}

/**
 * Restaura desde un archivo elegido por el usuario. Devuelve null si canceló.
 * Lo que ya existe NO se duplica: se agrega solo lo que falta.
 */
export const restoreBackup = createAsyncThunk<RestoreSummary | null, void, { state: RootState }>(
  'backup/restore',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const raw = await pickTextFile();
    if (raw === null) return null; // el usuario canceló

    const parsed = parseBackup(raw);
    if (!parsed.ok) return rejectWithValue(parsed.error) as never;

    const state = getState();
    const { events, notes } = itemsToRestore(parsed.backup, state.events.items, state.notes.items);
    const skipped =
      parsed.backup.events.length - events.length + (parsed.backup.notes.length - notes.length);

    // Secuencial: cada evento programa sus recordatorios al guardarse.
    for (const event of events) await dispatch(addEvent(event)).unwrap();
    for (const note of notes) await dispatch(addNote(note)).unwrap();
    // Los ids de eventos son locales al dispositivo de origen, por eso cada
    // saludo se restaura como invitado y conserva sus datos significativos.
    for (const greeting of parsed.backup.greetings ?? []) {
      await greetingsRepo.insertGuest(greeting.year, greeting.name, greeting.phone, greeting.greeted === 1);
    }

    return { events: events.length, notes: notes.length, skipped };
  },
);
