import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as customFieldsRepo from '@/db/custom-fields-repo';
import { addContactBirthdays, addEvent, editEvent, removeEvent } from '@/store/events-slice';
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
      })
      .addCase(addEvent.fulfilled, (state, action) => {
        const values = action.meta.arg.fieldValues;
        state.byEvent[action.payload.id] = customFieldsRepo.nonEmptyFieldValues(values ?? {});
      })
      .addCase(addContactBirthdays.fulfilled, (state, action) => {
        for (const event of action.payload) {
          const input = action.meta.arg.find((entry) => entry.contactId === event.contactId);
          state.byEvent[event.id] = customFieldsRepo.nonEmptyFieldValues(input?.fieldValues ?? {});
        }
      })
      .addCase(editEvent.fulfilled, (state, action) => {
        const values = action.meta.arg.data.fieldValues;
        // Omitir campos es una edición parcial (por ejemplo desde el perfil).
        if (values !== undefined) {
          state.byEvent[action.payload.id] = customFieldsRepo.nonEmptyFieldValues(values);
        }
      })
      .addCase(removeEvent.fulfilled, (state, action) => {
        delete state.byEvent[action.payload];
      });
  },
});

export default fieldValuesSlice.reducer;
