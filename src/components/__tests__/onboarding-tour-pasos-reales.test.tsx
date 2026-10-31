import { act, fireEvent, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OnboardingTour } from "@/components/onboarding-tour";
import { setSetting } from "@/db/settings-repo";
import { TourProvider, useTourTarget } from "@/onboarding/tour-context";
import { TOUR_TARGETS } from "@/onboarding/tour-steps";
import { restartOnboardingTour } from "@/store/settings-slice";
import { createTestStore, renderWithStore, type TestStore } from "@/test-utils";

/**
 * Recorrido guiado con sus pasos REALES (CRONO44): la bienvenida la hace la
 * pregunta "¿Querés un recorrido…?", así que el recorrido en sí arranca por
 * el buscador, tanto al aceptarlo como al reabrirlo desde Perfil.
 *
 * Se montan el buscador, el + y la pestaña Perfil: los pasos de los demás destinos
 * se omiten. Ya no hay paso "Antes de empezar" al final: los avisos están en la
 * tarjeta inicial y el último paso es Perfil, con "Terminar".
 */

jest.mock("@/db/settings-repo");

const mockSetSetting = jest.mocked(setSetting);

/** En Jest los métodos nativos de View no llaman al callback: se les da una medida fija. */
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

const DESTINOS = [
  TOUR_TARGETS.search,
  TOUR_TARGETS.add,
  TOUR_TARGETS.tabProfile,
];

function Destino({ id }: { id: string }) {
  const target = useTourTarget(id);
  return <View testID={`destino-${id}`} {...target} />;
}

async function renderTour(onboardingTourOpen: boolean): Promise<TestStore> {
  const store = createTestStore({
    settings: { displayName: "Nico", loaded: true, onboardingTourOpen },
  });
  await renderWithStore(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TourProvider>
        {DESTINOS.map((id) => (
          <Destino key={id} id={id} />
        ))}
        <OnboardingTour />
      </TourProvider>
    </SafeAreaProvider>,
    { store },
  );
  for (const id of DESTINOS) {
    await fireEvent(
      screen.getByTestId(`destino-${id}`, { includeHiddenElements: true }),
      "layout",
      {
        nativeEvent: { layout: RECT },
      },
    );
  }
  return store;
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

describe("<OnboardingTour /> con los pasos reales", () => {
  it('"Sí, mostrame" arranca por "Buscá en tu agenda"', async () => {
    await renderTour(true);

    await fireEvent.press(
      await screen.findByRole("button", { name: "Sí, mostrame" }),
    );

    expect(await screen.findByText("Buscá en tu agenda")).toBeTruthy();
  });

  it('reabierto desde Perfil arranca por "Buscá en tu agenda"', async () => {
    const store = await renderTour(false);

    await act(async () => {
      await store.dispatch(restartOnboardingTour());
    });

    expect(await screen.findByText("Buscá en tu agenda")).toBeTruthy();
  });

  it('la tarjeta inicial muestra "Antes de empezar" con los avisos', async () => {
    await renderTour(true);

    expect(await screen.findByText("Antes de empezar")).toBeTruthy();
    expect(
      screen.getByText(/único recordatorio para algo importante/),
    ).toBeTruthy();
  });

  it('el último paso es Perfil y ofrece "Terminar" (sin paso de cierre)', async () => {
    await renderTour(true);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Sí, mostrame" }),
    );
    await screen.findByText("Buscá en tu agenda");

    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByText("Agregá un evento");
    await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByText("Perfil")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Terminar" })).toBeTruthy();
  });

  it('el recorrido no incluye el paso "Antes de empezar"', async () => {
    await renderTour(true);
    await fireEvent.press(
      await screen.findByRole("button", { name: "Sí, mostrame" }),
    );
    await screen.findByText("Buscá en tu agenda");

    for (let vez = 0; vez < 2; vez += 1) {
      await fireEvent.press(screen.getByRole("button", { name: "Siguiente" }));
    }
    await screen.findByText("Perfil");

    expect(screen.queryByText("Antes de empezar")).toBeNull();
  });
});
