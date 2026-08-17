import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as greetingsSentRepo from '@/db/greetings-sent-repo';
import type { GreetingSent } from '@/types';

/** "Ya lo saludé" para cumpleaños/aniversarios ajenos, por año. Mismo patrón que greetings-slice. */

interface GreetingsSentState {
  year: number;
  items: GreetingSent[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: GreetingsSentState = {
  year: new Date().getFullYear(),
  items: [],
  status: 'idle',
};

export const loadGreetingsSent = createAsyncThunk('greetingsSent/load', async (year: number) => {
  const items = await greetingsSentRepo.findGreetingsSentByYear(year);
  return { year, items };
});

export const toggleGreetingSent = createAsyncThunk(
  'greetingsSent/toggle',
  async (payload: { year: number; eventId: number; greeted: boolean }) => {
    return greetingsSentRepo.setGreetingSent(payload.year, payload.eventId, payload.greeted);
  },
);

const greetingsSentSlice = createSlice({
  name: 'greetingsSent',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadGreetingsSent.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadGreetingsSent.fulfilled, (state, action) => {
        state.year = action.payload.year;
        state.items = action.payload.items;
        state.status = 'ready';
      })
      .addCase(loadGreetingsSent.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(toggleGreetingSent.fulfilled, (state, action) => {
        const index = state.items.findIndex((g) => g.id === action.payload.id);
        if (index === -1) state.items.push(action.payload);
        else state.items[index] = action.payload;
      });
  },
});

export default greetingsSentSlice.reducer;
