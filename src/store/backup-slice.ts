import { createAsyncThunk } from '@reduxjs/toolkit';

import {
  backupFileName,
  buildBackup,
  parseBackup,
  serializeBackup,
  type BackupEvent,
  type RestoreCounts,
  type RestoreSummary,
} from '@/backup/backup';
import { pickTextFile, saveAndShare } from '@/backup/file-io';
import * as backupRepo from '@/db/backup-repo';
import { cancelRemindersAfterCommit } from '@/notifications/cancel-after-commit';
import { scheduleEventReminders } from '@/notifications/notifications';
import { loadEventBases } from '@/store/event-bases-slice';
import { loadEventTypes } from '@/store/event-types-slice';
import { loadEvents } from '@/store/events-slice';
import { loadFieldValues } from '@/store/field-values-slice';
import { loadGreetings } from '@/store/greetings-slice';
import { loadGreetingsSent } from '@/store/greetings-sent-slice';
import { loadNotes } from '@/store/notes-slice';
import { loadSettings } from '@/store/settings-slice';
import type { RootState } from '@/store';
import { enforceMineBirthday, type EventReminder, type NewEvent } from '@/types';

/**
 * Exportar / restaurar la copia de seguridad.
 *
 * 💡 Aprendizaje: Redux es solo una copia en memoria (y perezosa) de lo que hay
 * en SQLite. Por eso el backup se arma LEYENDO LA BASE (db/backup-repo.ts), no
 * el estado: si no visitaste la pantalla de saludos, Redux no los tiene, pero
 * SQLite sí. Al restaurar pasa lo mismo a la inversa: se escribe en SQLite en
 * una sola transacción y recién después se recarga Redux desde la base.
 */

/** Exporta todo a un archivo y abre la hoja de Compartir (o lo descarga, en web). */
export const exportBackup = createAsyncThunk('backup/export', async () => {
  const backup = buildBackup(await backupRepo.readBackupSnapshot());

  await saveAndShare(backupFileName(), serializeBackup(backup));

  return {
    events: backup.events.length,
    notes: backup.notes.length,
    greetings: backup.greetings?.length ?? 0,
    greetingsSent: backup.greetingsSent?.length ?? 0,
  };
});

/** Los avisos se programan con los mismos datos que usa guardar un evento a mano. */
function toNewEvent({ ref: _ref, fieldValues: _fieldValues, ...event }: BackupEvent): NewEvent {
  return enforceMineBirthday(event as NewEvent);
}

/** Mensaje accionable: la restauración es atómica, así que lo previo siempre queda como estaba. */
function restoreFailure(cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(`${detail}\nNo se modificó ningún dato: podés volver a intentarlo.`, { cause });
}

/**
 * Restaura desde un archivo elegido por el usuario. Devuelve null si canceló.
 * Lo que ya existe NO se duplica: se agrega solo lo que falta.
 *
 * Orden y garantías:
 * 1. Se programan los avisos de los eventos que faltan (el SO no tiene rollback).
 * 2. Se escribe TODO en una única transacción SQLite.
 * 3. Si algo falla, SQLite revierte y se cancelan los avisos recién creados.
 */
export const restoreBackup = createAsyncThunk<RestoreSummary | null, void, { state: RootState }>(
  'backup/restore',
  async (_, { getState, dispatch, rejectWithValue }) => {
    const raw = await pickTextFile();
    if (raw === null) return null; // el usuario canceló

    const parsed = parseBackup(raw);
    if (!parsed.ok) return rejectWithValue(parsed.error) as never;
    const { backup, discarded } = parsed;

    const scheduled = new Map<number, EventReminder[]>();
    let counts: RestoreCounts;
    try {
      for (const index of await backupRepo.findMissingEventIndexes(backup)) {
        scheduled.set(index, await scheduleEventReminders(toNewEvent(backup.events[index])));
      }
      counts = await backupRepo.applyBackupRestore(backup, scheduled);
    } catch (error) {
      // Un aviso que no se pueda cancelar no tapa el error que explica la falla: se deja console.warn con sus ids.
      await Promise.all(
        [...scheduled.values()].map((reminders) => cancelRemindersAfterCommit(reminders, 'Restaurar copia')),
      );
      throw restoreFailure(error);
    }

    // Ya está confirmado en SQLite: se recarga la copia en memoria desde la base.
    const reloads = await Promise.all([
      dispatch(loadEvents()),
      dispatch(loadEventBases()),
      dispatch(loadEventTypes()),
      dispatch(loadFieldValues()),
      dispatch(loadNotes()),
      dispatch(loadSettings()),
      dispatch(loadGreetings(getState().greetings.year)),
      dispatch(loadGreetingsSent(getState().greetingsSent.year)),
    ]);

    return {
      ...counts,
      discarded: Object.values(discarded).reduce((sum, n) => sum + n, 0),
      refreshFailed: reloads.some((result) => result.meta.requestStatus === 'rejected'),
    };
  },
);
