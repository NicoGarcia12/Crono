import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as eventTypesRepo from '@/db/event-types-repo';
import type { EventTypeMeta } from '@/types';

/**
 * Tipos de evento (los 5 de fábrica + los que cree el usuario). Se cargan una
 * vez al arrancar. Crear, editar y borrar viven en store/type-config-thunks.ts,
 * porque además recargan bases, campos y eventos.
 */

interface EventTypesState {
  items: EventTypeMeta[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: EventTypesState = { items: [], status: 'idle' };

export const loadEventTypes = createAsyncThunk('eventTypes/load', async () => {
  return eventTypesRepo.findAllEventTypes();
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
      });
  },
});

export default eventTypesSlice.reducer;
