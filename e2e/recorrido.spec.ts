import { expect, test, type Page } from '@playwright/test';

import { completarBienvenida, saltarRecorrido } from './primer-uso';

/**
 * Recorrido guiado de primer uso (CRONO44): aparece sobre Agenda después de la
 * bienvenida, se recorre paso a paso y, al cerrarlo, queda cerrado para
 * siempre. Desde Perfil ("?") se puede volver a ver.
 */

/** Indicador "N de M" del globo del recorrido. */
const indicador = (page: Page) => page.getByText(/^\d+ de \d+$/);

/** true si el elemento con foco está dentro del diálogo del recorrido. */
const focoEnElRecorrido = (page: Page) =>
  page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));

/** Más Tab que elementos enfocables tiene el globo: obliga a dar la vuelta. */
const TECLAS_DE_VUELTA = 12;

test.describe('Recorrido de primer uso', () => {
  test('aparece tras la bienvenida, avanza hasta Terminar y no vuelve a aparecer', async ({ page }) => {
    await page.goto('/');
    await completarBienvenida(page);

    await expect(page.getByRole('button', { name: 'Saltar recorrido' })).toBeVisible();
    await expect(indicador(page)).toHaveText(/^1 de \d+$/);
    const total = Number((await indicador(page).textContent())?.split(' de ')[1]);
    expect(total).toBeGreaterThan(1);

    for (let paso = 2; paso <= total; paso += 1) {
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await expect(indicador(page)).toHaveText(`${paso} de ${total}`);
    }

    // Último paso: "Terminar" reemplaza a "Siguiente".
    await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Terminar' }).click();

    await expect(page.getByRole('button', { name: 'Saltar recorrido' })).toHaveCount(0);
    await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();

    // Queda cerrado para siempre: al recargar no vuelve.
    await page.reload();
    await page.getByRole('button', { name: 'Continuar sin bloqueo' }).click();
    await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saltar recorrido' })).toHaveCount(0);
  });

  test('"Ver recorrido de la app" en Perfil lo vuelve a mostrar en Agenda', async ({ page }) => {
    await page.goto('/');
    await completarBienvenida(page);
    await saltarRecorrido(page);

    await page.getByRole('tab', { name: /Perfil/ }).click();
    await page.getByRole('button', { name: 'Ver recorrido de la app' }).click();

    // Vuelve a Agenda (su estado vacío es exclusivo de esa pantalla) con el recorrido desde el paso 1.
    await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Saltar recorrido' })).toBeVisible();
    await expect(indicador(page)).toHaveText(/^1 de \d+$/);
  });

  test('con teclado, Tab y Shift+Tab no sacan el foco del recorrido', async ({ page }) => {
    await page.goto('/');
    await completarBienvenida(page);
    await expect(page.getByRole('button', { name: 'Saltar recorrido' })).toBeVisible();

    // Nunca llegan al buscador, los filtros, el + ni las pestañas de abajo.
    for (const tecla of ['Tab', 'Shift+Tab']) {
      for (let vez = 1; vez <= TECLAS_DE_VUELTA; vez += 1) {
        await page.keyboard.press(tecla);
        expect(await focoEnElRecorrido(page), `${tecla} n.º ${vez}`).toBe(true);
      }
    }
  });

  test('Escape cierra el recorrido como "Saltar" y queda cerrado', async ({ page }) => {
    await page.goto('/');
    await completarBienvenida(page);
    const saltar = page.getByRole('button', { name: 'Saltar recorrido' });
    await expect(saltar).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(saltar).toHaveCount(0);

    await page.reload();
    await page.getByRole('button', { name: 'Continuar sin bloqueo' }).click();
    await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();
    await expect(saltar).toHaveCount(0);
  });
});
