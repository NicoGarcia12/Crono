import { createAsyncThunk } from '@reduxjs/toolkit';

import {
  backupFieldKey,
  backupFileName,
  buildBackup,
  itemsToRestore,
  parseBackup,
  serializeBackup,
} from '@/backup/backup';
import { pickTextFile, saveAndShare } from '@/backup/file-io';
import * as eventTypesRepo from '@/db/event-types-repo';
import * as greetingsRepo from '@/db/greetings-repo';
import { loadEventBases } from '@/store/event-bases-slice';
import { loadEventTypes } from '@/store/event-types-slice';
import { addEvent } from '@/store/events-slice';
import { saveFieldValues } from '@/store/field-values-slice';
import { addNote } from '@/store/notes-slice';
import type { RootState } from '@/store';
import type { FieldValues } from '@/types';

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
    {
      bases: state.eventBases.bases,
      types: state.eventTypes.items,
      fields: state.eventBases.fields,
      values: state.fieldValues.byEvent,
    },
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
 * Valores del archivo ('type:Qué llevar' → valor) traducidos a los ids de
 * campo de ESTE celular, según el tipo del evento. Los que no encuentran su
 * campo se descartan.
 */
function resolveFieldValues(state: RootState, typeKey: string, byKey: Record<string, string>): FieldValues {
  const type = state.eventTypes.items.find((t) => t.key === typeKey);
  const base = state.eventBases.bases.find((b) => b.key === type?.baseKey);
  const fields = state.eventBases.fields.filter(
    (f) => (f.owner === 'base' && f.ownerId === base?.id) || (f.owner === 'type' && f.ownerId === type?.id),
  );
  return Object.fromEntries(
    fields.flatMap((f) => (byKey[backupFieldKey(f)] !== undefined ? [[f.id, byKey[backupFieldKey(f)]]] : [])),
  );
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

    // Primero las bases y tipos propios: los eventos del archivo apuntan a ellos.
    if (parsed.backup.typeConfig) {
      await eventTypesRepo.importTypeConfig(parsed.backup.typeConfig);
      await Promise.all([dispatch(loadEventBases()), dispatch(loadEventTypes())]);
    }

    const state = getState();
    const { events, notes } = itemsToRestore(parsed.backup, state.events.items, state.notes.items);
    const skipped =
      parsed.backup.events.length - events.length + (parsed.backup.notes.length - notes.length);

    // Secuencial: cada evento programa sus recordatorios al guardarse.
    for (const { fieldValues, ...event } of events) {
      const created = await dispatch(addEvent(event)).unwrap();
      const values = fieldValues ? resolveFieldValues(getState(), event.type, fieldValues) : {};
      if (Object.keys(values).length > 0) {
        await dispatch(saveFieldValues({ eventId: created.id, values })).unwrap();
      }
    }
    for (const note of notes) await dispatch(addNote(note)).unwrap();
    // Los ids de eventos son locales al dispositivo de origen, por eso cada
    // saludo se restaura como invitado y conserva sus datos significativos.
    for (const greeting of parsed.backup.greetings ?? []) {
      await greetingsRepo.insertGuest(greeting.year, greeting.name, greeting.phone, greeting.greeted === 1);
    }

    return { events: events.length, notes: notes.length, skipped };
  },
);
