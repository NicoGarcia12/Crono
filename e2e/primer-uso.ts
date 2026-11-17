import { expect, type Page } from "@playwright/test";

/**
 * Pasos compartidos del primer uso en web. No es un spec (no termina en
 * `.spec.ts`), así que Playwright no lo corre como test.
 */

/**
 * Toca "Desbloquear" (la pantalla de bloqueo es la misma que en el celular; en
 * web no hay credencial del sistema y solo deja un aviso en consola), carga el
 * nombre y toca "Empezar". En web no hay diálogo de avisos (no hay
 * recordatorios), así que la app queda en Agenda con la pregunta del recorrido.
 */
export async function completarBienvenida(page: Page, nombre = "Nico") {
  await page.getByRole("button", { name: "Desbloquear" }).click();
  await page.getByPlaceholder("¿Cómo te llamás?").fill(nombre);
  await page.getByText("Empezar").click();
}

/** Responde "No, gracias" a la pregunta del recorrido guiado (CRONO44): mientras está abierta tapa la Agenda. */
export async function rechazarRecorrido(page: Page) {
  const noGracias = page.getByRole("button", { name: "No, gracias" });
  await noGracias.click();
  await expect(noGracias).toHaveCount(0);
}

/** Primer uso completo para specs que no prueban el recorrido: bienvenida + rechazarlo. */
export async function empezarSinRecorrido(page: Page, nombre = "Nico") {
  await completarBienvenida(page, nombre);
  await rechazarRecorrido(page);
}

/** Recarga y vuelve a Agenda (la pantalla de bloqueo vuelve a aparecer y hay que desbloquear). */
export async function recargarHastaAgenda(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Desbloquear" }).click();
  await expect(page.getByText("Todavía no hay nada agendado")).toBeVisible();
}
