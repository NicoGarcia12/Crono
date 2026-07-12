import { expect, test } from '@playwright/test';

/**
 * Flujo crítico del calendario: un evento creado aparece en su día, la
 * navegación entre meses funciona y la vista semanal también.
 */
test('el evento creado aparece en el calendario y se puede navegar', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  // Creamos un evento con fecha conocida (20 de diciembre de 2026, domingo).
  await page.getByLabel('Agregar evento').click();
  await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Cena con amigos');
  await page.getByLabel('Fecha').fill('2026-12-20');
  await page.getByText('Crear evento').click();
  await expect(page.getByText('Cena con amigos').first()).toBeVisible();

  await page.getByText('Calendario').click();

  // Navegamos mes a mes hasta diciembre de 2026 (el título arranca en el mes actual).
  const periodo = page.getByText(/^[A-Z][a-zé]+ \d{4}$/);
  for (let i = 0; i < 24; i++) {
    if ((await periodo.innerText()) === 'Diciembre 2026') break;
    await page.getByLabel('Período siguiente').click();
  }
  await expect(periodo).toHaveText('Diciembre 2026');

  // Tocamos el día 20: abajo se listan los eventos de ese día.
  await page.getByLabel('Día 2026-12-20').click();
  await expect(page.getByText('Domingo 20 de diciembre de 2026')).toBeVisible();
  // La pestaña Agenda queda montada detrás, así que el título aparece dos veces.
  await expect(page.getByText('Cena con amigos').last()).toBeVisible();

  // La vista semanal muestra el rango de esa semana.
  await page.getByLabel('Vista semanal').click();
  await expect(page.getByText(/14 – 20 de diciembre de 2026/)).toBeVisible();
});
