import type * as Toolkit from "@reduxjs/toolkit";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import type * as ReactModule from "react";
import { AppState, Linking, type AppStateStatus } from "react-native";

import PerfilScreen from "@/app/(tabs)/perfil";
import { notify } from "@/components/confirm";
import { renderWithStore } from "@/test-utils";

/**
 * Fila "Avisos" de Perfil (CRONO44, ronda 2): deja activar los avisos a quien
 * ya tenía la app o los negó. Muestra el estado del permiso y, al tocarla:
 *  - 'askable' → mismo diálogo explicativo que la bienvenida y, al cerrarlo, el pedido;
 *  - 'blocked' → abre los ajustes del sistema (no se puede volver a pedir);
 *  - 'granted' → no hace nada.
 * Se refresca cuando la app vuelve a primer plano. Oculta sin recordatorios.
 */

type PermissionState = "granted" | "askable" | "blocked";

let mockRemindersAvailable = true;
const mockGetPermissionState = jest.fn<Promise<PermissionState>, []>();
const mockRequestPermission = jest.fn<Promise<boolean>, []>();

// `remindersAvailable` va con `Object.defineProperty` y no como `get` dentro del literal:
// con el spread, Babel arma el objeto con `_objectSpread`, que evalúa el getter una sola
// vez al crear el mock (cuando `mockRemindersAvailable` todavía no tiene valor) y lo
// congela en `undefined`. Así la fila nunca aparecía, aunque el test pusiera `true`.
jest.mock("@/notifications/notifications", () =>
  Object.defineProperty(
    {
      ...jest.requireActual<object>("@/notifications/notifications"),
      getNotificationPermissionState: () => mockGetPermissionState(),
      requestNotificationPermission: () => mockRequestPermission(),
    },
    "remindersAvailable",
    { get: () => mockRemindersAvailable, enumerable: true },
  ),
);
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  // Pantalla siempre "enfocada": el efecto corre al montar.
  useFocusEffect: (effect: ReactModule.EffectCallback) =>
    jest.requireActual<typeof ReactModule>("react").useEffect(effect, [effect]),
}));
jest.mock("@/components/confirm", () => ({
  confirmAction: jest.fn(),
  notify: jest.fn(),
}));
jest.mock("@/db/settings-repo");
jest.mock("@/store/backup-slice", () => {
  const { createAsyncThunk } =
    jest.requireActual<typeof Toolkit>("@reduxjs/toolkit");
  return {
    exportBackup: createAsyncThunk("backup/export", async () => undefined),
    restoreBackup: createAsyncThunk("backup/restore", async () => null),
  };
});
jest.mock("@/components/photo-picker", () => ({ PhotoPicker: () => null }));
jest.mock("@/components/my-birthday-card", () => ({
  MyBirthdayCard: () => null,
}));

const mockNotify = jest.mocked(notify);
const mockAddAppStateListener = jest.mocked(AppState.addEventListener);
const mockOpenSettings = jest.mocked(Linking.openSettings);

/** El nombre accesible de la fila empieza con "Avisos" e incluye el estado del permiso. */
const FILA_AVISOS = /^Avisos/;
const FILA_ACTIVADOS = /^Avisos.*\bactivados\b/i;
const FILA_BLOQUEADOS = /^Avisos.*bloquead/i;

const fila = (name: RegExp) => screen.findByRole("button", { name });

async function renderPerfil() {
  await renderWithStore(<PerfilScreen />, {
    settings: { displayName: "Nico", loaded: true, onboardingTourOpen: false },
  });
}

/** Espera a que la pantalla haya leído el permiso y pintado el resultado. */
async function esperarEstadoLeido() {
  await waitFor(() => expect(mockGetPermissionState).toHaveBeenCalled());
  await act(async () => undefined);
}

/** Dispara los listeners de AppState que registró la pantalla. */
async function volverAPrimerPlano() {
  const listeners = mockAddAppStateListener.mock.calls
    .filter(([type]) => type === "change")
    .map(([, listener]) => listener as (state: AppStateStatus) => void);
  await act(async () => {
    listeners.forEach((listener) => listener("active"));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemindersAvailable = true;
  mockGetPermissionState.mockResolvedValue("granted");
  mockRequestPermission.mockResolvedValue(true);
  mockNotify.mockResolvedValue(undefined);
  mockOpenSettings.mockResolvedValue(undefined);
});

describe("<PerfilScreen /> fila Avisos: estado", () => {
  it('con el permiso concedido muestra "Activados"', async () => {
    mockGetPermissionState.mockResolvedValue("granted");
    await renderPerfil();

    expect(await fila(FILA_ACTIVADOS)).toBeTruthy();
  });

  it("si el sistema lo bloqueó, lo indica como bloqueado", async () => {
    mockGetPermissionState.mockResolvedValue("blocked");
    await renderPerfil();

    expect(await fila(FILA_BLOQUEADOS)).toBeTruthy();
  });

  it("si se puede pedir, aparece sin decir activados ni bloqueados", async () => {
    mockGetPermissionState.mockResolvedValue("askable");
    await renderPerfil();
    await fila(FILA_AVISOS);
    await esperarEstadoLeido();

    expect([
      screen.queryByRole("button", { name: FILA_ACTIVADOS }),
      screen.queryByRole("button", { name: FILA_BLOQUEADOS }),
    ]).toEqual([null, null]);
  });

  it("sin recordatorios disponibles (web / Expo Go Android) no aparece", async () => {
    mockRemindersAvailable = false;
    await renderPerfil();
    await act(async () => undefined);

    expect(screen.queryByRole("button", { name: FILA_AVISOS })).toBeNull();
  });

  it("se refresca cuando la app vuelve a primer plano", async () => {
    mockGetPermissionState.mockResolvedValue("blocked");
    await renderPerfil();
    await fila(FILA_BLOQUEADOS);

    // El usuario lo habilitó desde los ajustes del celular y volvió a Crono.
    mockGetPermissionState.mockResolvedValue("granted");
    await volverAPrimerPlano();

    expect(await fila(FILA_ACTIVADOS)).toBeTruthy();
  });
});

describe("<PerfilScreen /> fila Avisos: al tocar", () => {
  it("con 'askable' muestra el diálogo explicativo", async () => {
    mockGetPermissionState.mockResolvedValue("askable");
    await renderPerfil();
    await esperarEstadoLeido();

    await fireEvent.press(await fila(FILA_AVISOS));

    await waitFor(() => expect(mockNotify).toHaveBeenCalledTimes(1));
  });

  it("con 'askable' pide el permiso recién al cerrar el diálogo", async () => {
    mockGetPermissionState.mockResolvedValue("askable");
    // El diálogo queda abierto hasta que el test lo resuelve (como tocar "Entendido").
    const dialogo = Promise.withResolvers<void>();
    mockNotify.mockReturnValue(dialogo.promise);
    await renderPerfil();
    await esperarEstadoLeido();

    await fireEvent.press(await fila(FILA_AVISOS));
    await waitFor(() => expect(mockNotify).toHaveBeenCalled());
    expect(mockRequestPermission).not.toHaveBeenCalled();

    await act(async () => dialogo.resolve());

    await waitFor(() => expect(mockRequestPermission).toHaveBeenCalledTimes(1));
  });

  it("con 'blocked' abre los ajustes del sistema", async () => {
    mockGetPermissionState.mockResolvedValue("blocked");
    await renderPerfil();

    await fireEvent.press(await fila(FILA_BLOQUEADOS));

    await waitFor(() => expect(mockOpenSettings).toHaveBeenCalledTimes(1));
  });

  it("con 'blocked' no muestra el diálogo ni pide el permiso", async () => {
    mockGetPermissionState.mockResolvedValue("blocked");
    await renderPerfil();

    await fireEvent.press(await fila(FILA_BLOQUEADOS));
    await waitFor(() => expect(mockOpenSettings).toHaveBeenCalled());

    expect([
      mockNotify.mock.calls.length,
      mockRequestPermission.mock.calls.length,
    ]).toEqual([0, 0]);
  });

  it("con 'granted' no pide nada ni abre ajustes", async () => {
    mockGetPermissionState.mockResolvedValue("granted");
    await renderPerfil();

    await fireEvent.press(await fila(FILA_ACTIVADOS));
    await act(async () => undefined);

    expect([
      mockNotify.mock.calls.length,
      mockRequestPermission.mock.calls.length,
      mockOpenSettings.mock.calls.length,
    ]).toEqual([0, 0, 0]);
  });
});
