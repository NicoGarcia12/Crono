import {
  AGENDA_TOUR_STEPS,
  TOUR_NOTICE,
  TOUR_QUESTION,
  TOUR_TARGETS,
} from "@/onboarding/tour-steps";

/**
 * El recorrido de primer uso es corto a propósito: 4 pasos (buscador, +,
 * Calendario y Perfil) con copies breves. La Agenda vacía se explica sola
 * con su estado vacío, así que no hay pasos para filtros, lista ni las
 * pestañas Agenda y Notas.
 */
describe("AGENDA_TOUR_STEPS", () => {
  it("tiene exactamente 4 pasos, en orden", () => {
    expect(AGENDA_TOUR_STEPS.map((step) => step.id)).toEqual([
      "buscar",
      "agregar",
      "tab-calendario",
      "tab-perfil",
    ]);
  });

  it("cada paso apunta a un target registrado en TOUR_TARGETS", () => {
    const targets = new Set<string>(Object.values(TOUR_TARGETS));
    for (const step of AGENDA_TOUR_STEPS) {
      expect(targets.has(step.target)).toBe(true);
    }
  });

  it("los copies son cortos: títulos de hasta 4 palabras y cuerpos de hasta 90 caracteres", () => {
    for (const step of AGENDA_TOUR_STEPS) {
      expect(step.title.split(/\s+/).length).toBeLessThanOrEqual(4);
      expect(step.body.length).toBeLessThanOrEqual(90);
    }
  });

  it("la tarjeta inicial mantiene los dos avisos en pocas palabras", () => {
    // Dos oraciones: una por cada hecho (avisos no garantizados; datos en el dispositivo).
    expect(TOUR_NOTICE.body.split(/(?<=\.)\s+/).length).toBeLessThanOrEqual(2);
    expect(TOUR_NOTICE.body).toMatch(/único recordatorio/);
    expect(TOUR_NOTICE.body).toMatch(/datos quedan/);
    expect(TOUR_QUESTION.body.length).toBeLessThanOrEqual(90);
  });
});
