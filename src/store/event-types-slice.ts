import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventTypesRepo from '@/db/event-types-repo';
import type { EventTypeMeta, NewEventType } from '@/types';

/** Tipos de evento (los 5 de fábrica + los que cree el usuario). Se cargan una vez al arrancar. */

interface EventTypesState {
  items: EventTypeMeta[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: EventTypesState = { items: [], status: 'idle' };

export const loadEventTypes = createAsyncThunk('eventTypes/load', async () => {
  return eventTypesRepo.findAllEventTypes();
});

export const addEventType = createAsyncThunk('eventTypes/add', async (data: NewEventType) => {
  return eventTypesRepo.createEventType(data);
});

export const editEventType = createAsyncThunk(
  'eventTypes/edit',
  async (payload: { id: number; data: NewEventType }) => {
    await eventTypesRepo.updateEventType(payload.id, payload.data);
    return payload;
  },
);

export const removeEventType = createAsyncThunk('eventTypes/remove', async (id: number) => {
  await eventTypesRepo.deleteEventType(id);
  return id;
});

const eventTypesSlice = createSlice({
  name: 'eventTypes',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadEventTypes.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadEventTypes.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = 'ready';
      })
      .addCase(loadEventTypes.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(addEventType.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })
      .addCase(editEventType.fulfilled, (state, action) => {
        const item = state.items.find((t) => t.id === action.payload.id);
        if (item) Object.assign(item, action.payload.data);
      })
      .addCase(removeEventType.fulfilled, (state, action) => {
        state.items = state.items.filter((t) => t.id !== action.payload);
      });
  },
});

export default eventTypesSlice.reducer;
