import { configureStore } from "@reduxjs/toolkit";

import { getSetting, setSetting } from "@/db/settings-repo";
import reducer, {
  completeOnboardingTour,
  loadSettings,
  restartOnboardingTour,
} from "@/store/settings-slice";

/**
 * Recorrido de primer uso (CRONO44): se guarda en el setting `onboardingTourDone`
 * ('1' = cerrado). Sin la clave —instalación nueva o usuario que actualiza— se muestra.
 */

jest.mock("@/db/settings-repo");

const mockGetSetting = jest.mocked(getSetting);
const mockSetSetting = jest.mocked(setSetting);

const makeStore = () => configureStore({ reducer: { settings: reducer } });

/** Simula la tabla de settings con solo las claves indicadas. */
const withSettings = (values: Record<string, string>) => {
  mockGetSetting.mockImplementation(async (key: string) => values[key] ?? null);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSetSetting.mockResolvedValue(undefined);
});

describe("loadSettings → onboardingTourOpen", () => {
  it("sin la clave guardada deja el recorrido pendiente", async () => {
    withSettings({ displayName: "Nico" });
    const store = makeStore();

    await store.dispatch(loadSettings());

    expect(store.getState().settings.onboardingTourOpen).toBe(true);
  });

  it("con '1' guardado marca el recorrido como cerrado", async () => {
    withSettings({ displayName: "Nico", onboardingTourDone: "1" });
    const store = makeStore();

    await store.dispatch(loadSettings());

    expect(store.getState().settings.onboardingTourOpen).toBe(false);
  });

  it("con '0' guardado (valor de versiones anteriores) lo deja pendiente", async () => {
    withSettings({ displayName: "Nico", onboardingTourDone: "0" });
    const store = makeStore();

    await store.dispatch(loadSettings());

    expect(store.getState().settings.onboardingTourOpen).toBe(true);
  });
});

describe("completeOnboardingTour", () => {
  it("persiste '1' en onboardingTourDone", async () => {
    const store = makeStore();

    await store.dispatch(completeOnboardingTour());

    expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1");
  });

  it("marca el recorrido como cerrado en el estado", async () => {
    const store = makeStore();

    await store.dispatch(completeOnboardingTour());

    expect(store.getState().settings.onboardingTourOpen).toBe(false);
  });
});

describe("restartOnboardingTour", () => {
  it("no persiste '0': reabrirlo desde Perfil es solo para esta sesión", async () => {
    const store = makeStore();
    await store.dispatch(completeOnboardingTour());

    await store.dispatch(restartOnboardingTour());

    expect(mockSetSetting).not.toHaveBeenCalledWith("onboardingTourDone", "0");
  });

  it("no escribe nada en SQLite", async () => {
    const store = makeStore();

    await store.dispatch(restartOnboardingTour());

    expect(mockSetSetting).not.toHaveBeenCalled();
  });
});
