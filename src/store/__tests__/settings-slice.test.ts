import { configureStore } from '@reduxjs/toolkit';

import { getSetting, setSetting } from '@/db/settings-repo';
import reducer, {
  completeOnboardingTour,
  loadSettings,
  restartOnboardingTour,
} from '@/store/settings-slice';

/**
 * Recorrido de primer uso (CRONO44): se guarda en el setting `onboardingTourDone`
 * ('1' = cerrado). Sin la clave —instalación nueva o usuario que actualiza— se muestra.
 */

jest.mock('@/db/settings-repo');

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

describe('loadSettings → onboardingTourDone', () => {
  it('sin la clave guardada deja el recorrido pendiente', async () => {
    withSettings({ displayName: 'Nico' });
    const store = makeStore();

    await store.dispatch(loadSettings());

    expect(store.getState().settings.onboardingTourDone).toBe(false);
  });

  it("con '1' guardado marca el recorrido como cerrado", async () => {
    withSettings({ displayName: 'Nico', onboardingTourDone: '1' });
    const store = makeStore();

    await store.dispatch(loadSettings());

    expect(store.getState().settings.onboardingTourDone).toBe(true);
  });

  it("con '0' guardado (recorrido reactivado) lo deja pendiente", async () => {
    withSettings({ displayName: 'Nico', onboardingTourDone: '0' });
    const store = makeStore();

    await store.dispatch(loadSettings());

    expect(store.getState().settings.onboardingTourDone).toBe(false);
  });
});

describe('completeOnboardingTour', () => {
  it("persiste '1' en onboardingTourDone", async () => {
    const store = makeStore();

    await store.dispatch(completeOnboardingTour());

    expect(mockSetSetting).toHaveBeenCalledWith('onboardingTourDone', '1');
  });

  it('marca el recorrido como cerrado en el estado', async () => {
    const store = makeStore();

    await store.dispatch(completeOnboardingTour());

    expect(store.getState().settings.onboardingTourDone).toBe(true);
  });
});

describe('restartOnboardingTour', () => {
  it("persiste '0' en onboardingTourDone", async () => {
    const store = makeStore();
    await store.dispatch(completeOnboardingTour());

    await store.dispatch(restartOnboardingTour());

    expect(mockSetSetting).toHaveBeenLastCalledWith('onboardingTourDone', '0');
  });

  it('vuelve a dejar el recorrido pendiente en el estado', async () => {
    const store = makeStore();
    await store.dispatch(completeOnboardingTour());

    await store.dispatch(restartOnboardingTour());

    expect(store.getState().settings.onboardingTourDone).toBe(false);
  });
});
