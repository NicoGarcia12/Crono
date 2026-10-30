import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { OnboardingTour } from '@/components/onboarding-tour';
import { setSetting } from '@/db/settings-repo';
import { TourProvider, useTourTarget } from '@/onboarding/tour-context';
import { createTestStore, renderWithStore, type TestStore } from '@/test-utils';

/**
 * Recorrido guiado (coach marks) de Agenda — CRONO44.
 *
 * Los pasos reales se reemplazan por 4 controlados: uno sin destino (globo
 * centrado), uno con destino montado, uno cuyo destino NO está montado (se
 * debe omitir) y el final sin destino. Así el total visible es 3.
 */

jest.mock('@/db/settings-repo');
jest.mock('@/onboarding/tour-steps', () => ({
  AGENDA_TOUR_STEPS: [
    { id: 'bienvenida', title: 'Paso sin destino', body: 'Texto del primer paso.' },
    { id: 'agregar', target: 'agregar', title: 'Paso con destino', body: 'Texto del paso con destino.' },
    { id: 'fantasma', target: 'no-montado', title: 'Paso sin elemento', body: 'No se debería ver.' },
    { id: 'cierre', title: 'Paso final', body: 'Texto del último paso.' },
  ],
}));

const mockSetSetting = jest.mocked(setSetting);

/**
 * En Jest los métodos nativos de View son `jest.fn()` vacíos (nunca llaman al
 * callback). Se les da una medida fija para que el destino montado sea medible
 * tanto si la implementación usa `measureInWindow`/`measure` como `onLayout`.
 */
type MeasureCallback = (...values: number[]) => void;
interface HostMeasureMethods {
  measure: jest.Mock<void, [MeasureCallback]>;
  measureInWindow: jest.Mock<void, [MeasureCallback]>;
}
const hostMethods = View.prototype as unknown as HostMeasureMethods;
const RECT = { x: 16, y: 120, width: 200, height: 48 };

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Destino({ id }: { id: string }) {
  const target = useTourTarget(id);
  return <View testID={`destino-${id}`} {...target} />;
}

async function renderTour(onboardingTourDone: boolean): Promise<TestStore> {
  const store = createTestStore({ settings: { displayName: 'Nico', loaded: true, onboardingTourDone } });
  await renderWithStore(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TourProvider>
        <Destino id="agregar" />
        <OnboardingTour />
      </TourProvider>
    </SafeAreaProvider>,
    { store },
  );
  // includeHiddenElements: el recorrido aparece apenas llegan las medidas y su
  // `accessibilityViewIsModal` deja al destino fuera del árbol accesible.
  await fireEvent(screen.getByTestId('destino-agregar', { includeHiddenElements: true }), 'layout', {
    nativeEvent: { layout: RECT },
  });
  return store;
}

const boton = (name: string) => screen.getByRole('button', { name });

async function avanzarHastaElFinal() {
  await screen.findByText('Paso sin destino');
  await fireEvent.press(boton('Siguiente'));
  await screen.findByText('Paso con destino');
  await fireEvent.press(boton('Siguiente'));
  await screen.findByText('Paso final');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetSetting.mockResolvedValue(undefined);
  hostMethods.measureInWindow.mockImplementation((callback) =>
    callback(RECT.x, RECT.y, RECT.width, RECT.height),
  );
  hostMethods.measure.mockImplementation((callback) =>
    callback(0, 0, RECT.width, RECT.height, RECT.x, RECT.y),
  );
});

afterEach(() => {
  hostMethods.measureInWindow.mockReset();
  hostMethods.measure.mockReset();
});

describe('<OnboardingTour />', () => {
  it('con el recorrido pendiente muestra el primer paso', async () => {
    await renderTour(false);

    expect(await screen.findByText('Paso sin destino')).toBeTruthy();
  });

  it('muestra el indicador "1 de M" contando solo los pasos visibles', async () => {
    await renderTour(false);

    expect(await screen.findByText('1 de 3')).toBeTruthy();
  });

  it('ofrece saltar el recorrido desde el primer paso', async () => {
    await renderTour(false);

    expect(await screen.findByRole('button', { name: 'Saltar recorrido' })).toBeTruthy();
  });

  it('Siguiente avanza al paso con destino montado', async () => {
    await renderTour(false);
    await screen.findByText('Paso sin destino');

    await fireEvent.press(boton('Siguiente'));

    expect(await screen.findByText('2 de 3')).toBeTruthy();
    expect(screen.getByText('Paso con destino')).toBeTruthy();
  });

  it('Anterior vuelve al paso previo', async () => {
    await renderTour(false);
    await screen.findByText('Paso sin destino');
    await fireEvent.press(boton('Siguiente'));
    await screen.findByText('Paso con destino');

    await fireEvent.press(boton('Anterior'));

    expect(await screen.findByText('Paso sin destino')).toBeTruthy();
  });

  it('omite el paso cuyo destino no está montado', async () => {
    await renderTour(false);

    await avanzarHastaElFinal();

    expect(screen.getByText('3 de 3')).toBeTruthy();
    expect(screen.queryByText('Paso sin elemento')).toBeNull();
  });

  it('en el último paso ofrece Terminar en lugar de Siguiente', async () => {
    await renderTour(false);

    await avanzarHastaElFinal();

    expect(boton('Terminar')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
  });

  it('Terminar cierra el recorrido en el store', async () => {
    const store = await renderTour(false);
    await avanzarHastaElFinal();

    await fireEvent.press(boton('Terminar'));

    await waitFor(() => expect(store.getState().settings.onboardingTourDone).toBe(true));
  });

  it("Terminar persiste el cierre ('1')", async () => {
    await renderTour(false);
    await avanzarHastaElFinal();

    await fireEvent.press(boton('Terminar'));

    await waitFor(() => expect(mockSetSetting).toHaveBeenCalledWith('onboardingTourDone', '1'));
  });

  it('Terminar oculta el recorrido', async () => {
    await renderTour(false);
    await avanzarHastaElFinal();

    await fireEvent.press(boton('Terminar'));

    await waitFor(() => expect(screen.queryByText('Paso final')).toBeNull());
  });

  it("Saltar cierra el recorrido y persiste el cierre ('1')", async () => {
    const store = await renderTour(false);
    await screen.findByText('Paso sin destino');

    await fireEvent.press(boton('Saltar recorrido'));

    await waitFor(() => expect(store.getState().settings.onboardingTourDone).toBe(true));
    expect(mockSetSetting).toHaveBeenCalledWith('onboardingTourDone', '1');
  });

  it('Saltar oculta el recorrido', async () => {
    await renderTour(false);
    await screen.findByText('Paso sin destino');

    await fireEvent.press(boton('Saltar recorrido'));

    await waitFor(() => expect(screen.queryByText('Paso sin destino')).toBeNull());
  });

  it('con el recorrido ya cerrado no muestra nada', async () => {
    await renderTour(true);

    expect(screen.queryByRole('button', { name: 'Saltar recorrido' })).toBeNull();
    expect(screen.queryByText('Paso sin destino')).toBeNull();
  });
});
