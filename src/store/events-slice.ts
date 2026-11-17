import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventTypesRepo from '@/db/event-types-repo';
import * as eventsRepo from '@/db/events-repo';
import { loadEventTypes } from '@/store/event-types-slice';
import { cancelRemindersAfterCommit, requireReminderCleanup } from '@/notifications/cancel-after-commit';
import { scheduleEventReminders } from '@/notifications/notifications';
import { enforceMineBirthday, type EventItem, type EventReminder, type NewEvent } from '@/types';

/**
 * Slice de eventos (Redux Toolkit, el mismo patrón que usás en React web).
 *
 * 💡 Aprendizaje: acá Redux es solo la copia EN MEMORIA de los datos; la
 * verdad vive en SQLite. Cada thunk hace primero el trabajo persistente
 * (BD + notificación) y recién después actualiza el estado. Por eso no
 * hace falta redux-persist: al reabrir la app, loadEvents() recarga todo.
 */

interface EventsState {
  items: EventItem[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: EventsState = { items: [], status: 'idle' };

export const loadEvents = createAsyncThunk('events/load', async () => {
  return eventsRepo.findAllEvents();
});

/**
 * "Cumpleaños" se puede borrar, pero mi cumpleaños, los saludos y la
 * importación de contactos lo necesitan: si falta, se vuelve a crear.
 * Solo se consulta la BD cuando el tipo no está en el estado.
 */
async function ensureBirthdayType(
  entries: readonly NewEvent[],
  getState: () => unknown,
  dispatch: (action: unknown) => unknown,
): Promise<void> {
  if (!entries.some((e) => e.type === 'cumpleanos')) return;
  // Sin los tipos cargados no se puede saber si falta; la app los carga al arrancar.
  const eventTypes = (getState() as { eventTypes?: { items: { key: string }[]; status: string } }).eventTypes;
  if (eventTypes?.status !== 'ready' || eventTypes.items.some((t) => t.key === 'cumpleanos')) return;
  if (await eventTypesRepo.ensureBuiltinType('cumpleanos')) await dispatch(loadEventTypes());
}

export const addEvent = createAsyncThunk('events/add', async (data: NewEvent, { getState, dispatch }) => {
  await requireReminderCleanup();
  const normalized = enforceMineBirthday(data);
  await ensureBirthdayType([normalized], getState, dispatch);
  // 1) Programar los avisos en el sistema, 2) guardar en SQLite con sus ids.
  const reminders = await scheduleEventReminders(normalized);
  try {
    return await eventsRepo.insertEvent(normalized, reminders);
  } catch (error: unknown) {
    // La compensación conserva sus IDs si el SO rechaza cancelar; el error
    // de SQLite sigue siendo la causa de que no se haya guardado el evento.
    await cancelRemindersAfterCommit(reminders, 'Crear evento fallido');
    throw error;
  }
});

/**
 * Importa cumpleaños de contactos como una unidad lógica usando el contrato
 * de avisos 1→N. La identidad es `contact_id`, que SQLite verifica dentro de
 * la transacción para no depender de una copia potencialmente vieja de Redux.
 */
export const addContactBirthdays = createAsyncThunk<EventItem[], readonly NewEvent[]>(
  'events/addContactBirthdays',
  async (entries: readonly NewEvent[], { getState, dispatch }) => {
    await requireReminderCleanup();
    await ensureBirthdayType(entries, getState, dispatch);
    const scheduledReminders: EventReminder[][] = [];
    try {
      for (const entry of entries) {
        scheduledReminders.push(await scheduleEventReminders(entry));
      }
      return await eventsRepo.insertContactBirthdays(entries, scheduledReminders);
    } catch (error: unknown) {
      await cancelRemindersAfterCommit(scheduledReminders.flat(), 'Importar cumpleaños fallido');
      throw error;
    }
  },
);

export const editEvent = createAsyncThunk(
  'events/edit',
  async (payload: { id: number; data: NewEvent; previousReminders: EventReminder[] }) => {
    await requireReminderCleanup();
    const normalized = enforceMineBirthday(payload.data);
    /**
     * Orden: 1) programar los reemplazos, 2) persistir, 3) cancelar los anteriores.
     * Las notificaciones nativas no tienen rollback, así que los avisos
     * anteriores se cancelan RECIÉN cuando SQLite confirmó:
     *  - si programar falla, nada cambió y los anteriores siguen activos;
     *  - si persistir falla, SQLite hizo rollback del evento y de sus filas de
     *    avisos (siguen apuntando a los ids anteriores, aún activos); sólo se
     *    deshacen los reemplazos recién creados para que no queden huérfanos.
     * Cancelar antes de persistir (el orden anterior) dejaba al evento sin
     * avisos si el guardado fallaba: SQLite revertía, el SO no.
     */
    const reminders = await scheduleEventReminders(normalized);

    let saved: EventItem;
    try {
      saved = await eventsRepo.updateEvent(payload.id, normalized, reminders);
    } catch (error) {
      await cancelRemindersAfterCommit(reminders, 'Editar evento fallido');
      throw error;
    }

    await cancelRemindersAfterCommit(payload.previousReminders, 'Editar evento');
    return saved;
  },
);

export const removeEvent = createAsyncThunk('events/remove', async (event: EventItem) => {
  // Borrar primero en SQLite: si falla, los avisos del evento siguen activos y
  // el evento sigue existiendo (antes se cancelaban antes de borrar y un fallo
  // dejaba un evento vivo sin avisos). Con el borrado confirmado se cancelan.
  await eventsRepo.deleteEvent(event.id);
  await cancelRemindersAfterCommit(event.reminders, 'Borrar evento');
  return event.id;
});

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadEvents.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadEvents.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'ready';
      })
      .addCase(loadEvents.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(addEvent.fulfilled, (state, action) => {
        // SQLite ya confirmó el cambio de dueño; Redux replica ambas marcas juntas.
        if (action.payload.isMine === 1) {
          for (const event of state.items) event.isMine = 0;
        }
        state.items.push(action.payload);
      })
      .addCase(addContactBirthdays.fulfilled, (state, action) => {
        state.items.push(...action.payload);
      })
      .addCase(editEvent.fulfilled, (state, action) => {
        if (action.payload.isMine === 1) {
          for (const event of state.items) event.isMine = 0;
        }
        const index = state.items.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(removeEvent.fulfilled, (state, action) => {
        state.items = state.items.filter((e) => e.id !== action.payload);
      });
  },
});

export default eventsSlice.reducer;
