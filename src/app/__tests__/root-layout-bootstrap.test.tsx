import { render, screen, waitFor } from "@testing-library/react-native";
import type * as ReactModule from "react";
import type * as ReactNative from "react-native";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import { reconcileReminders } from "@/notifications/reconcile";

/**
 * Arranque de la app (CRONO44): el bootstrap crea el canal Android de avisos
 * pero ya NO pide el permiso de notificaciones (eso pasa después de la
 * bienvenida, en NameSetup). Todo lo que toca BD, SO o pantallas se mockea:
 * acá solo importa qué funciones de notificaciones llama el arranque.
 */

const mockSetupChannel = jest.fn<Promise<void>, []>();
const mockRequestPermission = jest.fn<Promise<boolean>, []>();

jest.mock("@/notifications/notifications", () => ({
  remindersAvailable: true,
  setupNotificationChannel: () => mockSetupChannel(),
  requestNotificationPermission: () => mockRequestPermission(),
}));
jest.mock("@/notifications/reconcile", () => ({
  reconcileReminders: jest.fn().mockResolvedValue({ status: "current" }),
}));
jest.mock("@/db/database", () => ({
  initDatabase: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/db/photos-repo", () => ({
  cleanupPhotosWithNotice: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(true),
}));
jest.mock("expo-router", () => ({
  Stack: Object.assign(() => null, { Screen: () => null }),
}));
// La app arranca bloqueada: el gate de bloqueo solo deja una marca de que la app arrancó.
jest.mock("@/components/lock-screen", () => {
  const { createElement } = jest.requireActual<typeof ReactModule>("react");
  const { Text } = jest.requireActual<typeof ReactNative>("react-native");
  return { LockScreen: () => createElement(Text, null, "Pantalla de bloqueo") };
});
jest.mock("@/store", () => {
  const state = {
    settings: {
      displayName: "Nico",
      themePreference: "sistema",
      onboardingTourOpen: false,
    },
  };
  return {
    store: {
      dispatch: jest.fn(() => ({ unwrap: () => Promise.resolve() })),
      getState: () => state,
      subscribe: () => () => undefined,
    },
    useAppSelector: <T,>(selector: (s: typeof state) => T) => selector(state),
    useAppDispatch: () => jest.fn(),
  };
});

const mockHideSplash = jest.mocked(SplashScreen.hideAsync);
const mockReconcile = jest.mocked(reconcileReminders);

beforeEach(() => {
  jest.clearAllMocks();
  mockSetupChannel.mockResolvedValue(undefined);
  mockRequestPermission.mockResolvedValue(true);
});

describe("<RootLayout /> bootstrap", () => {
  it("crea el canal de notificaciones al arrancar", async () => {
    await render(<RootLayout />);

    await waitFor(() => expect(mockSetupChannel).toHaveBeenCalledTimes(1));
  });

  it("no pide el permiso de notificaciones al arrancar", async () => {
    await render(<RootLayout />);
    // `hideAsync` corre en el finally del bootstrap: el arranque ya terminó.
    await waitFor(() => expect(mockHideSplash).toHaveBeenCalled());

    expect(mockRequestPermission).not.toHaveBeenCalled();
  });
});

/** CRONO44 ronda 2: un fallo al crear el canal Android no puede dejar la app sin arrancar. */
describe("<RootLayout /> bootstrap si crear el canal falla", () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    mockSetupChannel.mockRejectedValue(new Error("Canal no disponible"));
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("arranca igual hasta la pantalla de bloqueo", async () => {
    await render(<RootLayout />);

    expect(await screen.findByText("Pantalla de bloqueo")).toBeTruthy();
  });

  it("no muestra el error de arranque", async () => {
    await render(<RootLayout />);
    await waitFor(() => expect(mockHideSplash).toHaveBeenCalled());

    expect(screen.queryByText("No se pudo iniciar Crono")).toBeNull();
  });

  it("sigue con la recuperación de avisos", async () => {
    await render(<RootLayout />);

    await waitFor(() => expect(mockReconcile).toHaveBeenCalled());
  });

  it("registra el fallo con console.warn", async () => {
    await render(<RootLayout />);
    await waitFor(() => expect(mockHideSplash).toHaveBeenCalled());

    expect(warn).toHaveBeenCalled();
  });
});
