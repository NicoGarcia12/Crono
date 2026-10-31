import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import * as photosRepo from "@/db/photos-repo";
import * as settingsRepo from "@/db/settings-repo";
import { THEME_PREFERENCES, type ThemePreference } from "@/theme/theme";

/** Preferencias del usuario: su nombre, el tema (claro/oscuro/automático) y el recorrido de primer uso. */

/**
 * Qué muestra el recorrido abierto: la tarjeta inicial ("Antes de empezar" + la
 * pregunta "¿Querés un recorrido por la app?") o directamente los pasos.
 */
type OnboardingTourMode = "intro" | "steps";

interface SettingsState {
  displayName: string | null;
  themePreference: ThemePreference;
  /** Foto de perfil del usuario, ya copiada al sandbox de la app (o null si no cargó ninguna). */
  photoUri: string | null;
  /** true cuando ya se leyó la BD (para saber si mostrar la pantalla de bienvenida). */
  loaded: boolean;
  /**
   * true mientras el recorrido está abierto en ESTA sesión (tarjeta inicial o
   * pasos). Es estado de la sesión: no refleja lo guardado en SQLite en la clave
   * 'onboardingTourDone' (la tarjeta inicial guarda '1' apenas se ve y sigue
   * abierta hasta que se responde).
   *
   * Arranca en false para no mostrar nada antes de leer la BD; `loadSettings` lo
   * pone en true si la clave falta o vale '0' (primer uso, o quien actualiza sin
   * haberlo visto). "No, gracias", Saltar y Terminar lo ponen en false; Perfil lo
   * vuelve a abrir (true) solo para esta sesión.
   */
  onboardingTourOpen: boolean;
  /**
   * Qué muestra el recorrido mientras está abierto (estado de sesión, no se guarda).
   * Arranca en 'intro' (primer uso); "Sí, mostrame" y Perfil lo pasan a 'steps'.
   */
  onboardingTourMode: OnboardingTourMode;
}

const initialState: SettingsState = {
  displayName: null,
  themePreference: "sistema",
  photoUri: null,
  loaded: false,
  onboardingTourOpen: false,
  onboardingTourMode: "intro",
};

export const loadSettings = createAsyncThunk("settings/load", async () => {
  const [displayName, theme, photoUri, tourDone] = await Promise.all([
    settingsRepo.getSetting("displayName"),
    settingsRepo.getSetting("themePreference"),
    settingsRepo.getSetting("photoUri"),
    settingsRepo.getSetting("onboardingTourDone"),
  ]);

  // El valor guardado puede ser cualquier cosa (BD vieja, backup raro): se valida.
  const themePreference = (THEME_PREFERENCES as readonly string[]).includes(
    theme ?? "",
  )
    ? (theme as ThemePreference)
    : "sistema";

  return {
    displayName,
    themePreference,
    photoUri: photoUri || null,
    onboardingTourOpen: tourDone !== "1",
  };
});

/**
 * Recibe la foto ELEGIDA (URI temporal del selector) o null para quitarla. El repositorio
 * la copia y publica la referencia; el estado sólo cambia con la URI ya persistida.
 */
export const savePhotoUri = createAsyncThunk(
  "settings/savePhotoUri",
  (selectedUri: string | null) => photosRepo.saveProfilePhoto(selectedUri),
);

export const saveThemePreference = createAsyncThunk(
  "settings/saveTheme",
  async (preference: ThemePreference) => {
    await settingsRepo.setSetting("themePreference", preference);
    return preference;
  },
);

export const saveDisplayName = createAsyncThunk(
  "settings/saveDisplayName",
  async (name: string) => {
    const trimmed = name.trim();
    await settingsRepo.setSetting("displayName", trimmed);
    return trimmed;
  },
);

/**
 * La tarjeta inicial se mostró: queda vista para siempre ('1') aunque se cierre la
 * app sin responder. No cambia el estado: la tarjeta sigue en pantalla hasta que se
 * la responda o se la cierre.
 */
export const markOnboardingTourSeen = createAsyncThunk(
  "settings/markOnboardingTourSeen",
  async () => {
    await settingsRepo.setSetting("onboardingTourDone", "1");
  },
);

/**
 * "No, gracias", Saltar o Terminar: cierra el recorrido. Vuelve a escribir '1'
 * (idempotente) por si la marca de visto falló o si el recorrido se abrió desde
 * Perfil sin haber pasado nunca por la tarjeta inicial.
 */
export const completeOnboardingTour = createAsyncThunk(
  "settings/completeOnboardingTour",
  async () => {
    await settingsRepo.setSetting("onboardingTourDone", "1");
  },
);

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    /** "Sí, mostrame" en la tarjeta inicial: el mismo recorrido abierto pasa al primer paso. */
    startOnboardingTour: (state) => {
      state.onboardingTourMode = "steps";
    },
    /**
     * "Ver recorrido de la app" en Perfil: lo abre directo en los pasos (sin la
     * tarjeta ni los avisos) solo para esta sesión.
     *
     * 💡 Es una acción síncrona común (no un thunk) porque no toca SQLite: si se
     * recarga la app a mitad del recorrido, `loadSettings` lee el '1' guardado y no
     * vuelve a aparecer.
     */
    restartOnboardingTour: (state) => {
      state.onboardingTourOpen = true;
      state.onboardingTourMode = "steps";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.displayName = action.payload.displayName;
        state.themePreference = action.payload.themePreference;
        state.photoUri = action.payload.photoUri;
        state.loaded = true;
        state.onboardingTourOpen = action.payload.onboardingTourOpen;
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
      // 💡 Se actualiza en `pending` (optimista): el recorrido se cierra al toque. Si la
      // escritura en SQLite fallara, lo peor es que en el próximo arranque se vea de
      // nuevo, sin dejar a la persona trabada en el overlay.
      .addCase(completeOnboardingTour.pending, (state) => {
        state.onboardingTourOpen = false;
      });
  },
});

export const { startOnboardingTour, restartOnboardingTour } =
  settingsSlice.actions;
export default settingsSlice.reducer;
