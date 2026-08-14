import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as settingsRepo from '@/db/settings-repo';
import { THEME_PREFERENCES, type ThemePreference } from '@/theme/theme';

/** Preferencias del usuario: su nombre y el tema (claro/oscuro/automático). */

interface SettingsState {
  displayName: string | null;
  themePreference: ThemePreference;
  /** true cuando ya se leyó la BD (para saber si mostrar la pantalla de bienvenida). */
  loaded: boolean;
}

const initialState: SettingsState = {
  displayName: null,
  themePreference: 'sistema',
  loaded: false,
};

export const loadSettings = createAsyncThunk('settings/load', async () => {
  const [displayName, theme] = await Promise.all([
    settingsRepo.getSetting('displayName'),
    settingsRepo.getSetting('themePreference'),
  ]);

  // El valor guardado puede ser cualquier cosa (BD vieja, backup raro): se valida.
  const themePreference = (THEME_PREFERENCES as readonly string[]).includes(theme ?? '')
    ? (theme as ThemePreference)
    : 'sistema';

  return { displayName, themePreference };
});

export const saveThemePreference = createAsyncThunk(
  'settings/saveTheme',
  async (preference: ThemePreference) => {
    await settingsRepo.setSetting('themePreference', preference);
    return preference;
  },
);

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
        state.displayName = action.payload.displayName;
        state.themePreference = action.payload.themePreference;
        state.loaded = true;
      })
      .addCase(saveDisplayName.fulfilled, (state, action) => {
        state.displayName = action.payload;
      })
      .addCase(saveThemePreference.fulfilled, (state, action) => {
        state.themePreference = action.payload;
      });
  },
});

export default settingsSlice.reducer;
