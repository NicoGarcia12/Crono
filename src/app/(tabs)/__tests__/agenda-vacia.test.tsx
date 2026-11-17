import { fireEvent, screen } from "@testing-library/react-native";

import AgendaScreen from "@/app/(tabs)/index";
import { renderWithStore } from "@/test-utils";

/**
 * Estado vacío de Agenda: en vez de un recorrido largo, la pantalla vacía
 * ofrece directo "Agregar evento" (misma navegación que el +). El botón solo
 * aparece cuando la lista está vacía de verdad: sin búsqueda ni filtro, porque
 * con un filtro activo el vacío no significa "no tenés nada".
 */

// expo-router se mockea: en Jest no hay navegador ni stack nativo, solo nos
// importa saber a dónde se navega.
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// EventCard usa módulos nativos (fotos); con la lista vacía no se renderiza igual.
jest.mock("@/components/event-card", () => ({ EventCard: () => null }));

const BOTON = "Agregar evento";

beforeEach(() => {
  mockPush.mockClear();
});

describe("Agenda vacía", () => {
  it('sin eventos muestra "Agregar evento" y navega igual que el +', async () => {
    await renderWithStore(<AgendaScreen />);

    // Se busca por rol: el + flotante no es "button" (solo tiene label), así que
    // el único botón accesible con ese nombre es el del estado vacío.
    const boton = screen.getByRole("button", { name: /Agregar evento/ });
    expect(screen.getByText(BOTON)).toBeTruthy();

    await fireEvent.press(boton);

    expect(mockPush).toHaveBeenCalledWith("/evento/nuevo");
  });

  it("con una búsqueda sin resultados no aparece", async () => {
    await renderWithStore(<AgendaScreen />);

    await fireEvent.changeText(
      screen.getByPlaceholderText("Buscar por nombre, tipo o descripción…"),
      "Pepe",
    );

    expect(screen.getByText("Sin resultados")).toBeTruthy();
    expect(screen.queryByText(BOTON)).toBeNull();
  });

  it("con un filtro de tipo activo no aparece", async () => {
    await renderWithStore(<AgendaScreen />);

    await fireEvent.press(screen.getByText("Cumpleaños"));

    expect(screen.getByText("Nada agendado de este tipo")).toBeTruthy();
    expect(screen.queryByText(BOTON)).toBeNull();
  });
});
