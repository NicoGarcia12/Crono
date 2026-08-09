import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminders, scheduleEventReminders } from '@/notifications/notifications';
import type { EventItem, EventReminder, NewEvent } from '@/types';

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

export const addEvent = createAsyncThunk('events/add', async (data: NewEvent) => {
  // 1) Programar los avisos en el sistema, 2) guardar en SQLite con sus ids.
  const reminders = await scheduleEventReminders(data);
  return eventsRepo.insertEvent(data, reminders);
});

/**
 * Importa cumpleaños como lote. Las notificaciones pertenecen al SO, no a
 * SQLite, así que no participan del rollback nativo: si falla la BD las
 * cancelamos explícitamente para que no queden avisos sin su recordatorio.
 */
export const addContactBirthdays = createAsyncThunk(
  'events/addContactBirthdays',
  async (entries: readonly NewEvent[]) => {
    const scheduledReminders: EventReminder[][] = [];
    try {
      for (const entry of entries) {
        scheduledReminders.push(await scheduleEventReminders(entry));
      }
      return await eventsRepo.insertContactBirthdays(entries, scheduledReminders);
    } catch (error: unknown) {
      // Este cleanup corre en JS luego del rechazo async de SQLite; SQLite ya
      // revirtió las filas y acá revertimos el efecto externo del scheduler.
      await Promise.all(scheduledReminders.map((reminders) => cancelReminders(reminders)));
      throw error;
    }
  },
);

export const editEvent = createAsyncThunk(
  'events/edit',
  async (payload: { id: number; data: NewEvent; previousReminders: EventReminder[] }) => {
    // Al editar, los avisos viejos quedan obsoletos: se cancelan y se programan de nuevo.
    await cancelReminders(payload.previousReminders);
    const reminders = await scheduleEventReminders(payload.data);
    const { reminders: _chosen, ...eventData } = payload.data;
    const updated: EventItem = { ...eventData, id: payload.id, reminders };
    await eventsRepo.updateEvent(updated);
    return updated;
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
