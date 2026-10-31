import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OnboardingTour } from "@/components/onboarding-tour";
import { getSetting, setSetting } from "@/db/settings-repo";
import { TourProvider, useTourTarget } from "@/onboarding/tour-context";
import { loadSettings, restartOnboardingTour } from "@/store/settings-slice";
import { createTestStore, renderWithStore, type TestStore } from "@/test-utils";

/**
 * Recorrido guiado (coach marks) de Agenda — CRONO44.
 *
 * La primera vez no arranca solo: una tarjeta inicial muestra "Antes de empezar"
 * (límites de los avisos y dónde quedan los datos) y pregunta si se quiere el
 * recorrido. Apenas se muestra se guarda como visto ('1'): si se cierra la app
 * sin responder, no vuelve. Reabierto desde Perfil va directo al primer paso,
 * sin tarjeta ni avisos, y no toca SQLite (es solo para esa sesión).
 *
 * Los pasos reales se reemplazan por 3 controlados: dos con destino montado y
 * uno cuyo destino NO está montado (se debe omitir). Ya no hay paso de cierre:
 * el total visible es 2 y el último paso real ofrece "Terminar".
 */

jest.mock("@/db/settings-repo");
jest.mock("@/onboarding/tour-steps", () => ({
  // El resto del módulo queda real: solo se controlan los pasos.
  ...jest.requireActual<object>("@/onboarding/tour-steps"),
  AGENDA_TOUR_STEPS: [
    {
      id: "buscar",
      target: "buscar",
      title: "Primer paso",
      body: "Texto del primer paso.",
    },
    {
      id: "fantasma",
      target: "no-montado",
      title: "Paso sin elemento",
      body: "No se debería ver.",
    },
    {
      id: "agregar",
      target: "agregar",
      title: "Paso con destino",
      body: "Texto del paso con destino.",
    },
  ],
}));

const mockGetSetting = jest.mocked(getSetting);
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

const DESTINOS = ["buscar", "agregar"] as const;
const PREGUNTA = "¿Querés un recorrido por la app?";
const INDICADOR = /^\d+ de \d+$/;
const AVISOS_TITULO = "Antes de empezar";
/** Fragmento común a todas las variantes del texto de avisos (web / con o sin recordatorios). */
const AVISOS_TEXTO = /único recordatorio para algo importante/;

function Destino({ id }: { id: string }) {
  const target = useTourTarget(id);
  return <View testID={`destino-${id}`} {...target} />;
}

type SettingsOverride = NonNullable<
  Parameters<typeof createTestStore>[0]
>["settings"];

/** `onboardingTourOpen` = recorrido abierto según la BD; `null` = estado inicial (BD sin cargar). */
async function renderTour(
  onboardingTourOpen: boolean | null,
): Promise<TestStore> {
  const settings: SettingsOverride =
    onboardingTourOpen === null
      ? {}
      : { displayName: "Nico", loaded: true, onboardingTourOpen };
  const store = createTestStore({ settings });
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
  // includeHiddenElements: el overlay aparece apenas llegan las medidas y su
  // `accessibilityViewIsModal` deja a los destinos fuera del árbol accesible.
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

const boton = (name: string) => screen.getByRole("button", { name });

/** Responde "Sí, mostrame" a la pregunta y espera el primer paso. */
async function aceptarRecorrido() {
  await fireEvent.press(
    await screen.findByRole("button", { name: "Sí, mostrame" }),
  );
  await screen.findByText("Primer paso");
}

async function avanzarHastaElFinal() {
  await aceptarRecorrido();
  await fireEvent.press(boton("Siguiente"));
  await screen.findByText("Paso con destino");
}

/** Perfil → "Ver recorrido de la app" sobre un recorrido ya visto. */
async function reabrirDesdePerfil(): Promise<TestStore> {
  const store = await renderTour(false);
  await act(async () => {
    await store.dispatch(restartOnboardingTour());
  });
  await screen.findByText("Primer paso");
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSetSetting.mockResolvedValue(undefined);
  // Tabla de settings vacía: falta la clave del recorrido (instalación nueva o app actualizada).
  mockGetSetting.mockResolvedValue(null);
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

describe("<OnboardingTour /> pregunta de primer uso", () => {
  it("con el recorrido pendiente pregunta si se quiere el recorrido", async () => {
    await renderTour(true);

    expect(await screen.findByText(PREGUNTA)).toBeTruthy();
  });

  it('la pregunta ofrece "No, gracias"', async () => {
    await renderTour(true);

    expect(
      await screen.findByRole("button", { name: "No, gracias" }),
    ).toBeTruthy();
  });

  it('la pregunta ofrece "Sí, mostrame"', async () => {
    await renderTour(true);

    expect(
      await screen.findByRole("button", { name: "Sí, mostrame" }),
    ).toBeTruthy();
  });

  it('la pregunta no muestra el indicador "N de M"', async () => {
    await renderTour(true);
    await screen.findByText(PREGUNTA);

    expect(screen.queryByText(INDICADOR)).toBeNull();
  });

  it("la pregunta no muestra todavía el primer paso", async () => {
    await renderTour(true);
    await screen.findByText(PREGUNTA);

    expect(screen.queryByText("Primer paso")).toBeNull();
  });

  it("quien actualiza la app sin haber cerrado nunca el recorrido también ve la pregunta", async () => {
    // Arranca con el estado inicial (BD sin leer), como en la app real.
    const store = await renderTour(null);

    await act(async () => {
      await store.dispatch(loadSettings());
    });

    expect(await screen.findByText(PREGUNTA)).toBeTruthy();
  });
});

describe("<OnboardingTour /> tarjeta inicial: avisos y guardado inmediato", () => {
  it('muestra el bloque "Antes de empezar"', async () => {
    await renderTour(true);

    expect(await screen.findByText(AVISOS_TITULO)).toBeTruthy();
  });

  it("muestra el texto de los avisos", async () => {
    await renderTour(true);

    expect(await screen.findByText(AVISOS_TEXTO)).toBeTruthy();
  });

  it("muestra los avisos junto a la pregunta", async () => {
    await renderTour(true);
    await screen.findByText(PREGUNTA);

    expect(screen.getByText(AVISOS_TITULO)).toBeTruthy();
  });

  it("apenas se muestra persiste el recorrido como visto ('1') sin que el usuario toque nada", async () => {
    await renderTour(true);
    await screen.findByText(PREGUNTA);

    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1"),
    );
  });

  it("sigue visible después de guardarse como visto", async () => {
    await renderTour(true);
    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1"),
    );

    expect(screen.getByText(PREGUNTA)).toBeTruthy();
  });

  it("quien actualiza la app también la guarda como vista al verla", async () => {
    const store = await renderTour(null);

    await act(async () => {
      await store.dispatch(loadSettings());
    });
    await screen.findByText(PREGUNTA);

    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1"),
    );
  });
});

describe("<OnboardingTour /> con la BD sin cargar", () => {
  it("no muestra la tarjeta", async () => {
    await renderTour(null);

    expect(screen.queryByText(PREGUNTA)).toBeNull();
  });

  it("no muestra el recorrido", async () => {
    await renderTour(null);

    expect(
      screen.queryByRole("button", { name: "Saltar recorrido" }),
    ).toBeNull();
  });

  it("no guarda nada", async () => {
    await renderTour(null);

    expect(mockSetSetting).not.toHaveBeenCalled();
  });
});

describe('<OnboardingTour /> "No, gracias"', () => {
  it("persiste el cierre ('1')", async () => {
    await renderTour(true);

    await fireEvent.press(
      await screen.findByRole("button", { name: "No, gracias" }),
    );

    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1"),
    );
  });

  it("oculta la pregunta", async () => {
    await renderTour(true);

    await fireEvent.press(
      await screen.findByRole("button", { name: "No, gracias" }),
    );

    await waitFor(() => expect(screen.queryByText(PREGUNTA)).toBeNull());
  });
});

describe('<OnboardingTour /> "Sí, mostrame"', () => {
  it("arranca el recorrido en el primer paso", async () => {
    await renderTour(true);

    await fireEvent.press(
      await screen.findByRole("button", { name: "Sí, mostrame" }),
    );

    expect(await screen.findByText("Primer paso")).toBeTruthy();
  });

  it('el indicador "1 de M" cuenta solo los pasos visibles, no la pregunta', async () => {
    await renderTour(true);

    await aceptarRecorrido();

    expect(screen.getByText("1 de 2")).toBeTruthy();
  });

  it("el recorrido ya no repite los avisos", async () => {
    await renderTour(true);

    await aceptarRecorrido();

    expect(screen.queryByText(AVISOS_TITULO)).toBeNull();
  });
});

describe("<OnboardingTour /> recorrido", () => {
  it("ofrece saltar el recorrido desde el primer paso", async () => {
    await renderTour(true);

    await aceptarRecorrido();

    expect(boton("Saltar recorrido")).toBeTruthy();
  });

  it("Siguiente avanza al paso con destino montado", async () => {
    await renderTour(true);
    await aceptarRecorrido();

    await fireEvent.press(boton("Siguiente"));

    expect(await screen.findByText("Paso con destino")).toBeTruthy();
  });

  it("Anterior vuelve al paso previo", async () => {
    await renderTour(true);
    await aceptarRecorrido();
    await fireEvent.press(boton("Siguiente"));
    await screen.findByText("Paso con destino");

    await fireEvent.press(boton("Anterior"));

    expect(await screen.findByText("Primer paso")).toBeTruthy();
  });

  it("omite el paso cuyo destino no está montado", async () => {
    await renderTour(true);

    await avanzarHastaElFinal();

    expect(screen.getByText("2 de 2")).toBeTruthy();
    expect(screen.queryByText("Paso sin elemento")).toBeNull();
  });

  it("el último paso es el último real (sin paso de cierre)", async () => {
    await renderTour(true);

    await avanzarHastaElFinal();

    expect(boton("Terminar")).toBeTruthy();
  });

  it("en el último paso ofrece Terminar en lugar de Siguiente", async () => {
    await renderTour(true);

    await avanzarHastaElFinal();

    expect(boton("Terminar")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Siguiente" })).toBeNull();
  });

  it("Terminar cierra el recorrido en el store", async () => {
    const store = await renderTour(true);
    await avanzarHastaElFinal();

    await fireEvent.press(boton("Terminar"));

    await waitFor(() =>
      expect(store.getState().settings.onboardingTourOpen).toBe(false),
    );
  });

  it("Terminar persiste el cierre ('1')", async () => {
    await renderTour(true);
    await avanzarHastaElFinal();

    await fireEvent.press(boton("Terminar"));

    await waitFor(() =>
      expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1"),
    );
  });

  it("Terminar oculta el recorrido", async () => {
    await renderTour(true);
    await avanzarHastaElFinal();

    await fireEvent.press(boton("Terminar"));

    await waitFor(() =>
      expect(screen.queryByText("Paso con destino")).toBeNull(),
    );
  });

  it("Saltar cierra el recorrido y persiste el cierre ('1')", async () => {
    const store = await renderTour(true);
    await aceptarRecorrido();

    await fireEvent.press(boton("Saltar recorrido"));

    await waitFor(() =>
      expect(store.getState().settings.onboardingTourOpen).toBe(false),
    );
    expect(mockSetSetting).toHaveBeenCalledWith("onboardingTourDone", "1");
  });

  it("Saltar oculta el recorrido", async () => {
    await renderTour(true);
    await aceptarRecorrido();

    await fireEvent.press(boton("Saltar recorrido"));

    await waitFor(() => expect(screen.queryByText("Primer paso")).toBeNull());
  });

  it("con el recorrido ya cerrado no muestra nada", async () => {
    await renderTour(false);

    expect(screen.queryByText(PREGUNTA)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Saltar recorrido" }),
    ).toBeNull();
  });
});

describe("<OnboardingTour /> reabierto desde Perfil", () => {
  it("arranca directo en el primer paso", async () => {
    await reabrirDesdePerfil();

    expect(screen.getByText("1 de 2")).toBeTruthy();
  });

  it("no vuelve a preguntar", async () => {
    await reabrirDesdePerfil();

    expect(screen.queryByText(PREGUNTA)).toBeNull();
  });

  it("no muestra los avisos", async () => {
    await reabrirDesdePerfil();

    expect(screen.queryByText(AVISOS_TITULO)).toBeNull();
  });

  it("no persiste el recorrido como pendiente ('0')", async () => {
    await reabrirDesdePerfil();

    expect(mockSetSetting).not.toHaveBeenCalledWith("onboardingTourDone", "0");
  });

  it("ofrece Terminar en el último paso real", async () => {
    await reabrirDesdePerfil();

    await fireEvent.press(boton("Siguiente"));

    expect(
      await screen.findByRole("button", { name: "Terminar" }),
    ).toBeTruthy();
  });
});
