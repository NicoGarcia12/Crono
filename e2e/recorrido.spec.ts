import { expect, test, type Page } from "@playwright/test";

import {
  completarBienvenida,
  rechazarRecorrido,
  recargarHastaAgenda,
} from "./primer-uso";

/**
 * Recorrido guiado de primer uso (CRONO44): después de la bienvenida, Agenda
 * muestra una tarjeta con "Antes de empezar" (avisos y datos) y la pregunta
 * de si se quiere el recorrido. Apenas aparece queda guardada como vista: al
 * recargar, con o sin respuesta y aun a mitad del recorrido, no vuelve. Desde
 * Perfil ("?") se puede volver a ver, directo en el primer paso, sin tarjeta y
 * solo para esa sesión.
 */

const PREGUNTA = "¿Querés un recorrido por la app?";
const AVISOS = "Antes de empezar";

/** Indicador "N de M" del globo del recorrido. */
const indicador = (page: Page) => page.getByText(/^\d+ de \d+$/);

/** true si el elemento con foco está dentro del diálogo del recorrido. */
const focoEnElRecorrido = (page: Page) =>
  page.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"]')),
  );

/** Más Tab que elementos enfocables tiene el globo: obliga a dar la vuelta. */
const TECLAS_DE_VUELTA = 12;

/** Tab y Shift+Tab nunca llegan al buscador, los filtros, el + ni las pestañas de abajo. */
async function esperarFocoAtrapado(page: Page) {
  for (const tecla of ["Tab", "Shift+Tab"]) {
    for (let vez = 1; vez <= TECLAS_DE_VUELTA; vez += 1) {
      await page.keyboard.press(tecla);
      expect(await focoEnElRecorrido(page), `${tecla} n.º ${vez}`).toBe(true);
    }
  }
}

/** Ni la tarjeta inicial ni el recorrido están en pantalla. */
async function esperarSinRecorrido(page: Page) {
  await expect(page.getByText(PREGUNTA)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Saltar recorrido" }),
  ).toHaveCount(0);
}

test.describe("Recorrido de primer uso", () => {
  test("tras la bienvenida pregunta si se quiere el recorrido, sin arrancarlo", async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);

    await expect(page.getByText(AVISOS)).toBeVisible();
    await expect(
      page.getByText(/único recordatorio para algo importante/),
    ).toBeVisible();
    await expect(page.getByText(PREGUNTA)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "No, gracias" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sí, mostrame" }),
    ).toBeVisible();
    await expect(indicador(page)).toHaveCount(0);
  });

  test("recargar sin responder la tarjeta no la vuelve a mostrar", async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await expect(page.getByText(PREGUNTA)).toBeVisible();

    await recargarHastaAgenda(page);
    await esperarSinRecorrido(page);
  });

  test('"Sí, mostrame" y recargar a mitad del recorrido no lo vuelve a mostrar', async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await page.getByRole("button", { name: "Sí, mostrame" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(indicador(page)).toHaveText(/^2 de \d+$/);

    await recargarHastaAgenda(page);
    await esperarSinRecorrido(page);
  });

  test('"No, gracias" lo cierra y no vuelve a preguntar al recargar', async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);

    await rechazarRecorrido(page);
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
    await expect(page.getByText("Todavía no hay nada agendado")).toBeVisible();

    await recargarHastaAgenda(page);
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Saltar recorrido" }),
    ).toHaveCount(0);
  });

  test('"Sí, mostrame" recorre los pasos hasta Terminar y no vuelve a aparecer', async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);

    await page.getByRole("button", { name: "Sí, mostrame" }).click();

    // Arranca en el primer paso real (el buscador): la pregunta no cuenta como paso.
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
    await expect(page.getByText("Buscá en tu agenda")).toBeVisible();
    await expect(indicador(page)).toHaveText(/^1 de \d+$/);
    const total = Number(
      (await indicador(page).textContent())?.split(" de ")[1],
    );
    expect(total).toBeGreaterThan(1);

    for (let paso = 2; paso <= total; paso += 1) {
      await page.getByRole("button", { name: "Siguiente" }).click();
      await expect(indicador(page)).toHaveText(`${paso} de ${total}`);
    }

    // Último paso: el real (Perfil), sin "Antes de empezar" al final; "Terminar" reemplaza a "Siguiente".
    await expect(
      page.getByRole("dialog").getByText("Perfil", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(AVISOS)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Siguiente" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Terminar" }).click();

    await expect(
      page.getByRole("button", { name: "Saltar recorrido" }),
    ).toHaveCount(0);
    await expect(page.getByText("Todavía no hay nada agendado")).toBeVisible();

    // Queda cerrado para siempre: al recargar no vuelve ni la pregunta ni el recorrido.
    await recargarHastaAgenda(page);
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Saltar recorrido" }),
    ).toHaveCount(0);
  });

  test('"Ver recorrido de la app" en Perfil lo abre en Agenda directo en el primer paso', async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await rechazarRecorrido(page);

    await page.getByRole("tab", { name: /Perfil/ }).click();
    await page.getByRole("button", { name: "Ver recorrido de la app" }).click();

    // Vuelve a Agenda (su estado vacío es exclusivo de esa pantalla) con el recorrido desde el paso 1, sin preguntar.
    await expect(page.getByText("Todavía no hay nada agendado")).toBeVisible();
    await expect(page.getByText("Buscá en tu agenda")).toBeVisible();
    await expect(indicador(page)).toHaveText(/^1 de \d+$/);
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
    await expect(page.getByText(AVISOS)).toHaveCount(0);
  });

  test("desde Perfil, recargar a mitad del recorrido no lo vuelve a mostrar", async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await rechazarRecorrido(page);
    await page.getByRole("tab", { name: /Perfil/ }).click();
    await page.getByRole("button", { name: "Ver recorrido de la app" }).click();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(indicador(page)).toHaveText(/^2 de \d+$/);

    await recargarHastaAgenda(page);
    await esperarSinRecorrido(page);
  });

  test("con teclado, Tab y Shift+Tab no sacan el foco de la pregunta ni del recorrido", async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await expect(
      page.getByRole("button", { name: "Sí, mostrame" }),
    ).toBeVisible();

    await esperarFocoAtrapado(page);

    await page.getByRole("button", { name: "Sí, mostrame" }).click();
    await expect(
      page.getByRole("button", { name: "Saltar recorrido" }),
    ).toBeVisible();

    await esperarFocoAtrapado(page);
  });

  test('Escape en la pregunta responde "No, gracias" y queda cerrado', async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await expect(page.getByText(PREGUNTA)).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);

    await recargarHastaAgenda(page);
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
  });

  test('Escape a mitad del recorrido lo cierra como "Saltar" y queda cerrado', async ({
    page,
  }) => {
    await page.goto("/");
    await completarBienvenida(page);
    await page.getByRole("button", { name: "Sí, mostrame" }).click();
    const saltar = page.getByRole("button", { name: "Saltar recorrido" });
    await expect(saltar).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(saltar).toHaveCount(0);

    await recargarHastaAgenda(page);
    await expect(page.getByText(PREGUNTA)).toHaveCount(0);
    await expect(saltar).toHaveCount(0);
  });
});
