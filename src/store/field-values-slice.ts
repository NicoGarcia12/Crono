import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as customFieldsRepo from '@/db/custom-fields-repo';
import type { FieldValues } from '@/types';

/** Valores de los campos personalizados de cada evento (id de evento → valores). */

interface FieldValuesState {
  byEvent: Record<number, FieldValues>;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const initialState: FieldValuesState = { byEvent: {}, status: 'idle' };

export const loadFieldValues = createAsyncThunk('fieldValues/load', async () => {
  return customFieldsRepo.findAllFieldValues();
});

export const saveFieldValues = createAsyncThunk(
  'fieldValues/save',
  async (payload: { eventId: number; values: FieldValues }) => {
    const values = await customFieldsRepo.saveEventFieldValues(payload.eventId, payload.values);
    return { eventId: payload.eventId, values };
  },
);

const fieldValuesSlice = createSlice({
  name: 'fieldValues',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadFieldValues.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(loadFieldValues.fulfilled, (state, action) => {
        state.byEvent = action.payload;
        state.status = 'ready';
      })
      .addCase(loadFieldValues.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(saveFieldValues.fulfilled, (state, action) => {
        state.byEvent[action.payload.eventId] = action.payload.values;
      });
  },
});

export default fieldValuesSlice.reducer;
