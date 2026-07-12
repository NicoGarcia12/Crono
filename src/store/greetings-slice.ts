import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as greetingsRepo from '@/db/greetings-repo';
import type { Greeting } from '@/types';

/** Saludos recibidos en mi cumpleaños, por año. Mismo patrón que los otros slices. */

interface GreetingsState {
  /** Año que se está mirando en la pantalla. */
  year: number;
  items: Greeting[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: GreetingsState = {
  year: new Date().getFullYear(),
  items: [],
  status: 'idle',
};

export const loadGreetings = createAsyncThunk('greetings/load', async (year: number) => {
  const items = await greetingsRepo.findGreetingsByYear(year);
  return { year, items };
});

/** Tilda/destilda a alguien de mi agenda. */
export const toggleAgendaGreeting = createAsyncThunk(
  'greetings/toggleAgenda',
  async (payload: {
    year: number;
    eventId: number;
    name: string;
    phone: string | null;
    greeted: boolean;
  }) => {
    return greetingsRepo.setGreetedForEvent(
      payload.year,
      payload.eventId,
      payload.name,
      payload.phone,
      payload.greeted,
    );
  },
);

/** Tilda/destilda a alguien anotado a mano. */
export const toggleGuestGreeting = createAsyncThunk(
  'greetings/toggleGuest',
  async (payload: { id: number; greeted: boolean }) => {
    await greetingsRepo.setGreetedById(payload.id, payload.greeted);
    return payload;
  },
);

/** Suma a la lista a alguien que no tengo en la agenda (ya marcado como que saludó). */
export const addGuest = createAsyncThunk(
  'greetings/addGuest',
  async (payload: { year: number; name: string; phone: string | null }) => {
    return greetingsRepo.insertGuest(payload.year, payload.name.trim(), payload.phone, true);
  },
);

export const removeGuest = createAsyncThunk('greetings/removeGuest', async (id: number) => {
  await greetingsRepo.deleteGreeting(id);
  return id;
});

/** Cuando a un invitado se le carga el cumpleaños, su fila queda enlazada a ese evento. */
export const linkGuestToEvent = createAsyncThunk(
  'greetings/link',
  async (payload: { id: number; eventId: number }) => {
    await greetingsRepo.linkGuestToEvent(payload.id, payload.eventId);
    return payload;
  },
);

const greetingsSlice = createSlice({
  name: 'greetings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadGreetings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadGreetings.fulfilled, (state, action) => {
        state.year = action.payload.year;
        state.items = action.payload.items;
        state.status = 'ready';
      })
      .addCase(loadGreetings.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(toggleAgendaGreeting.fulfilled, (state, action) => {
        const index = state.items.findIndex((g) => g.id === action.payload.id);
        if (index === -1) state.items.push(action.payload);
        else state.items[index] = action.payload;
      })
      .addCase(toggleGuestGreeting.fulfilled, (state, action) => {
        const guest = state.items.find((g) => g.id === action.payload.id);
        if (guest) guest.greeted = action.payload.greeted ? 1 : 0;
      })
      .addCase(addGuest.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(removeGuest.fulfilled, (state, action) => {
        state.items = state.items.filter((g) => g.id !== action.payload);
      })
      .addCase(linkGuestToEvent.fulfilled, (state, action) => {
        // Al cargarle el cumpleaños, la persona deja de ser "anotada a mano" y
        // pasa a ser la de la agenda: conserva su saludo, sin duplicarse.
        const guest = state.items.find((g) => g.id === action.payload.id);
        if (guest) guest.eventId = action.payload.eventId;
      });
  },
});

export default greetingsSlice.reducer;
