import { expect, test } from '@playwright/test';

/**
 * Flujo crítico de Crono: primer uso → crear un evento → verlo en la agenda.
 *
 * En web no hay bloqueo del sistema, así que la app pasa directo a la
 * pantalla de bienvenida cuando la BD todavía no tiene nombre guardado.
 */
test.describe('Crear evento (flujo crítico)', () => {
  test('primer uso: pide el nombre, crea un evento y persiste tras recargar', async ({ page }) => {
    await page.goto('/');

    // 1) Primer uso: pantalla de bienvenida
    const nameInput = page.getByPlaceholder('¿Cómo te llamás?');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Nico');
    await page.getByText('Empezar').click();

    // 2) Agenda vacía
    await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();

    // 3) Crear un evento desde el FAB
    await page.getByLabel('Agregar evento').click();
    await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Cena con amigos');
    await page.getByLabel('Fecha').fill('2026-12-20');
    await page.getByText('Crear evento').click();

    // 4) El evento aparece en la agenda
    await expect(page.getByText('Cena con amigos')).toBeVisible();

    // 5) Persistencia: al recargar, el evento sigue (SQLite, no estado en memoria)
    await page.reload();
    await expect(page.getByText('Cena con amigos')).toBeVisible();
    // Y ya no vuelve a pedir el nombre
    await expect(page.getByPlaceholder('¿Cómo te llamás?')).toHaveCount(0);
  });

  test('no deja crear un evento sin título', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
    await page.getByText('Empezar').click();
    await page.getByLabel('Agregar evento').click();

    // Sin título, el botón está deshabilitado: tocarlo no navega ni crea nada.
    await page.getByText('Crear evento').click({ force: true });
    await expect(page.getByPlaceholder('Ej: Cumpleaños de mamá')).toBeVisible();
  });
});
