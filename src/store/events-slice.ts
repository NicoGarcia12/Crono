import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventTypesRepo from '@/db/event-types-repo';
import * as eventsRepo from '@/db/events-repo';
import { loadEventTypes } from '@/store/event-types-slice';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
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
  const normalized = enforceMineBirthday(data);
  await ensureBirthdayType([normalized], getState, dispatch);
  // 1) Programar los avisos en el sistema, 2) guardar en SQLite con sus ids.
  const reminders = await scheduleEventReminders(normalized);
  try {
    return await eventsRepo.insertEvent(normalized, reminders);
  } catch (error: unknown) {
    // Expo programa en el SO fuera de la transacción de SQLite. Si SQLite
    // rechaza el evento, cancelamos los ids recién creados para no dejarlos
    // huérfanos. allSettled conserva el error de persistencia original.
    await Promise.allSettled([cancelReminders(reminders)]);
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
    await ensureBirthdayType(entries, getState, dispatch);
    const scheduledReminders: EventReminder[][] = [];
    try {
      for (const entry of entries) {
        scheduledReminders.push(await scheduleEventReminders(entry));
      }
      return await eventsRepo.insertContactBirthdays(entries, scheduledReminders);
    } catch (error: unknown) {
      // SQLite revierte sus filas dentro de la transacción; este cleanup corre
      // en JS para revertir el efecto externo de TODOS los avisos ya creados.
      // allSettled conserva el error original aunque falle una cancelación.
      await Promise.allSettled(scheduledReminders.map((reminders) => cancelReminders(reminders)));
      throw error;
    }
  },
);

export const editEvent = createAsyncThunk(
  'events/edit',
  async (payload: { id: number; data: NewEvent; previousReminders: EventReminder[] }) => {
    const normalized = enforceMineBirthday(payload.data);
    /**
      * Primero pedimos los reemplazos al SO. A diferencia de SQLite, las
      * notificaciones nativas no tienen rollback: con este orden, si programar
      * falla los avisos anteriores siguen activos y el evento no se modifica.
      */
    const reminders = await scheduleEventReminders(normalized);

    try {
      await cancelReminders(payload.previousReminders);
      return await eventsRepo.updateEvent(payload.id, normalized, reminders);
    } catch (error) {
      // Si falla un paso posterior, no dejamos reemplazos huérfanos en el SO.
      await Promise.allSettled([cancelReminders(reminders)]);
      throw error;
    }
  },
);

export const removeEvent = createAsyncThunk('events/remove', async (event: EventItem) => {
  await cancelReminders(event.reminders);
  await eventsRepo.deleteEvent(event.id);
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
        state.items.push(action.payload);
      })
      .addCase(addContactBirthdays.fulfilled, (state, action) => {
        state.items.push(...action.payload);
      })
      .addCase(editEvent.fulfilled, (state, action) => {
        const index = state.items.findIndex((e) => e.id === action.payload.id);
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(removeEvent.fulfilled, (state, action) => {
        state.items = state.items.filter((e) => e.id !== action.payload);
      });
  },
});

export default eventsSlice.reducer;
