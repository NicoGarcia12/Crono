import { expect, test } from '@playwright/test';

/** El buscador filtra la agenda (sin tildes) y el detalle muestra la cuenta regresiva. */
test('busca eventos y muestra la cuenta regresiva en el detalle', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  const crear = async (titulo: string, fecha: string) => {
    await page.getByLabel('Agregar evento').click();
    await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill(titulo);
    await page.getByLabel('Fecha').fill(fecha);
    await page.getByText('Crear evento').click();
    await expect(page.getByText(titulo).first()).toBeVisible();
  };

  await crear('Cumple de mamá', '2026-12-20');
  await crear('Cena con amigos', '2026-07-16');

  // Buscar sin tilde encuentra igual.
  await page.getByLabel('Buscar eventos').fill('mama');
  await expect(page.getByText('Cumple de mamá')).toBeVisible();
  await expect(page.getByText('Cena con amigos')).toHaveCount(0);

  // Sin resultados avisa.
  await page.getByLabel('Buscar eventos').fill('asado');
  await expect(page.getByText('Sin resultados')).toBeVisible();

  // Limpiar devuelve la lista completa.
  await page.getByLabel('Limpiar búsqueda').click();
  await expect(page.getByText('Cumple de mamá')).toBeVisible();
  await expect(page.getByText('Cena con amigos')).toBeVisible();

  // El detalle del evento muestra la cuenta regresiva.
  await page.getByText('Cena con amigos').click();
  await expect(page.getByText(/Faltan \d+ días|Falta 1 día|Es hoy/)).toBeVisible();
});
