import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventsRepo from '@/db/events-repo';
import { cancelReminder, scheduleEventReminder } from '@/notifications/notifications';
import type { EventItem, NewEvent } from '@/types';

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
  // 1) Programar el recordatorio en el sistema, 2) guardar en SQLite con el id de la notificación.
  const notificationId = await scheduleEventReminder(data);
  return eventsRepo.insertEvent(data, notificationId);
});

/** Estado mínimo que necesita el lote; mantiene al slice testeable en aislamiento. */
interface EventsRootState {
  events: Pick<EventsState, 'items'>;
}

function birthdayIdentity(event: Pick<NewEvent, 'title' | 'date'>): string {
  return `${event.title.trim().toLocaleLowerCase('es-AR')}|${event.date.slice(5)}`;
}

/**
 * Importa cumpleaños como una unidad lógica.
 *
 * SQLite y las notificaciones son dos recursos distintos: JavaScript no puede
 * abrir una transacción nativa que incluya ambos. Por eso el rollback es
 * compensatorio: ante un error deshace las filas ya insertadas y cancela todos
 * los avisos programados. Redux recibe el lote recién al finalizar todo.
 */
export const importBirthdayEvents = createAsyncThunk<EventItem[], NewEvent[], { state: EventsRootState }>(
  'events/importBirthdays',
  async (events, { getState }) => {
    const existing = new Set(
      getState().events.items.filter((event) => event.type === 'cumpleanos').map(birthdayIdentity),
    );
    const uniqueEvents = events.filter((event) => {
      const identity = birthdayIdentity(event);
      if (existing.has(identity)) return false;
      existing.add(identity);
      return true;
    });

    const saved: EventItem[] = [];
    const notificationIds: string[] = [];

    try {
      for (const event of uniqueEvents) {
        const notificationId = await scheduleEventReminder(event);
        if (notificationId) notificationIds.push(notificationId);
        const persisted = await eventsRepo.insertEvent(event, notificationId);
        // El repositorio sólo asigna identidad persistida; los campos del
        // evento vienen del input validado, no de una respuesta externa.
        saved.push({ ...event, id: persisted.id, notificationId });
      }
      return saved;
    } catch (error: unknown) {
      // allSettled evita que una limpieza fallida tape el error original.
      await Promise.allSettled([
        ...saved.map((event) => eventsRepo.deleteEvent(event.id)),
        ...notificationIds.map((notificationId) => cancelReminder(notificationId)),
      ]);
      throw error;
    }
  },
);

export const editEvent = createAsyncThunk(
  'events/edit',
  async (payload: { id: number; data: NewEvent; previousNotificationId: string | null }) => {
    // Al editar, la notificación vieja queda obsoleta: se cancela y se programa una nueva.
    await cancelReminder(payload.previousNotificationId);
    const notificationId = await scheduleEventReminder(payload.data);
    const updated: EventItem = { ...payload.data, id: payload.id, notificationId };
    await eventsRepo.updateEvent(updated);
    return updated;
  },
);

export const removeEvent = createAsyncThunk('events/remove', async (event: EventItem) => {
  await cancelReminder(event.notificationId);
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
      .addCase(importBirthdayEvents.fulfilled, (state, action) => {
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
