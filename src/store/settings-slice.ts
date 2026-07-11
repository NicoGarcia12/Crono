import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as settingsRepo from '@/db/settings-repo';

/** Preferencias del usuario. Por ahora: su nombre para personalizar la app. */

interface SettingsState {
  displayName: string | null;
  /** true cuando ya se leyó la BD (para saber si mostrar la pantalla de bienvenida). */
  loaded: boolean;
}

const initialState: SettingsState = { displayName: null, loaded: false };

export const loadSettings = createAsyncThunk('settings/load', async () => {
  return settingsRepo.getSetting('displayName');
});

export const saveDisplayName = createAsyncThunk('settings/saveDisplayName', async (name: string) => {
  const trimmed = name.trim();
  await settingsRepo.setSetting('displayName', trimmed);
  return trimmed;
});

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.displayName = action.payload;
        state.loaded = true;
      })
      .addCase(saveDisplayName.fulfilled, (state, action) => {
        state.displayName = action.payload;
      });
  },
});

export default settingsSlice.reducer;
