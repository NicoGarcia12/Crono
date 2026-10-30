import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import * as photosRepo from '@/db/photos-repo';
import * as settingsRepo from '@/db/settings-repo';
import { THEME_PREFERENCES, type ThemePreference } from '@/theme/theme';

/** Preferencias del usuario: su nombre, el tema (claro/oscuro/automático) y el recorrido de primer uso. */

interface SettingsState {
  displayName: string | null;
  themePreference: ThemePreference;
  /** Foto de perfil del usuario, ya copiada al sandbox de la app (o null si no cargó ninguna). */
  photoUri: string | null;
  /** true cuando ya se leyó la BD (para saber si mostrar la pantalla de bienvenida). */
  loaded: boolean;
  /**
   * true si el recorrido guiado de Agenda ya se cerró (Saltar o Terminar).
   * Arranca en true para no mostrarlo antes de leer la BD; `loadSettings` lo pone en
   * false si falta la clave, así también lo ven una vez quienes actualizan la app.
   */
  onboardingTourDone: boolean;
}

const initialState: SettingsState = {
  displayName: null,
  themePreference: 'sistema',
  photoUri: null,
  loaded: false,
  onboardingTourDone: true,
};

export const loadSettings = createAsyncThunk('settings/load', async () => {
  const [displayName, theme, photoUri, tourDone] = await Promise.all([
    settingsRepo.getSetting('displayName'),
    settingsRepo.getSetting('themePreference'),
    settingsRepo.getSetting('photoUri'),
    settingsRepo.getSetting('onboardingTourDone'),
  ]);

  // El valor guardado puede ser cualquier cosa (BD vieja, backup raro): se valida.
  const themePreference = (THEME_PREFERENCES as readonly string[]).includes(theme ?? '')
    ? (theme as ThemePreference)
    : 'sistema';

  return { displayName, themePreference, photoUri: photoUri || null, onboardingTourDone: tourDone === '1' };
});

/**
 * Recibe la foto ELEGIDA (URI temporal del selector) o null para quitarla. El repositorio
 * la copia y publica la referencia; el estado sólo cambia con la URI ya persistida.
 */
export const savePhotoUri = createAsyncThunk('settings/savePhotoUri', (selectedUri: string | null) =>
  photosRepo.saveProfilePhoto(selectedUri),
);

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

/** Saltar o Terminar el recorrido: queda cerrado para siempre ('1'). */
export const completeOnboardingTour = createAsyncThunk('settings/completeOnboardingTour', async () => {
  await settingsRepo.setSetting('onboardingTourDone', '1');
});

/** "Ver recorrido de la app" en Perfil: lo vuelve a dejar pendiente ('0'). */
export const restartOnboardingTour = createAsyncThunk('settings/restartOnboardingTour', async () => {
  await settingsRepo.setSetting('onboardingTourDone', '0');
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
        state.photoUri = action.payload.photoUri;
        state.loaded = true;
        state.onboardingTourDone = action.payload.onboardingTourDone;
      })
      .addCase(saveDisplayName.fulfilled, (state, action) => {
        state.displayName = action.payload;
      })
      .addCase(saveThemePreference.fulfilled, (state, action) => {
        state.themePreference = action.payload;
      })
      .addCase(savePhotoUri.fulfilled, (state, action) => {
        state.photoUri = action.payload;
      })
      // 💡 Se actualiza en `pending` (optimista): el recorrido se cierra o se abre al
      // toque. Si la escritura en SQLite fallara, lo peor es que en el próximo
      // arranque se vea de nuevo (o no), sin dejar a la persona trabada en el overlay.
      .addCase(completeOnboardingTour.pending, (state) => {
        state.onboardingTourDone = true;
      })
      .addCase(restartOnboardingTour.pending, (state) => {
        state.onboardingTourDone = false;
      });
  },
});

export default settingsSlice.reducer;
