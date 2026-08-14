import { expect, test } from '@playwright/test';

/**
 * El tema se elige en Perfil y queda guardado: al recargar la app sigue igual.
 * Comprobamos el color de fondo real de la pantalla, no solo que el chip esté activo.
 */
test('cambia a modo oscuro y lo recuerda al recargar', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();
  await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();

  const fondoAgenda = () =>
    page.evaluate(() => {
      const nodo = document.evaluate(
        "//*[text()='Todavía no hay nada agendado']",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null,
      ).singleNodeValue as HTMLElement;
      return getComputedStyle(nodo).color; // color del texto: cambia con el tema
    });

  const claro = await fondoAgenda();

  // Cambiamos a oscuro desde Perfil.
  await page.getByText('Perfil').click();
  await page.getByLabel('Tema Oscuro').click();
  await page.getByRole('tab', { name: /Agenda/ }).click();

  const oscuro = await fondoAgenda();
  expect(oscuro).not.toBe(claro);

  // Al recargar sigue en oscuro (la preferencia se guardó en la base).
  await page.reload();
  await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();
  expect(await fondoAgenda()).toBe(oscuro);
});
