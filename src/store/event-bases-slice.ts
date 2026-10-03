import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventBasesRepo from '@/db/event-bases-repo';
import type { CustomField, EventBase } from '@/types';

/** Bases de los tipos de evento y sus campos personalizados. Se cargan una vez al arrancar. */

interface EventBasesState {
  bases: EventBase[];
  fields: CustomField[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: EventBasesState = { bases: [], fields: [], status: 'idle' };

export const loadEventBases = createAsyncThunk('eventBases/load', async () => {
  const [bases, fields] = await Promise.all([
    eventBasesRepo.findAllEventBases(),
    eventBasesRepo.findAllCustomFields(),
  ]);
  return { bases, fields };
});

const eventBasesSlice = createSlice({
  name: 'eventBases',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadEventBases.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadEventBases.fulfilled, (state, action) => {
        state.bases = action.payload.bases;
        state.fields = action.payload.fields;
        state.status = 'ready';
      })
      .addCase(loadEventBases.rejected, (state) => {
        state.status = 'error';
      });
  },
});

export default eventBasesSlice.reducer;
