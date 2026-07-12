import { expect, test } from '@playwright/test';

/**
 * Mi cumpleaños: marcarlo, ver la lista de quién me saludó (con los cumpleaños
 * que tengo cargados), tildar a alguien y sumar a alguien que no está.
 */
test('marca mi cumpleaños y registra quién me saludó', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  const crearCumple = async (nombre: string, fecha: string) => {
    await page.getByLabel('Agregar evento').click();
    await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill(nombre);
    await page.getByText('Cumpleaños', { exact: true }).last().click();
    await page.getByLabel('Fecha').fill(fecha);
    await page.getByText('Crear evento').click();
    await expect(page.getByText(nombre).first()).toBeVisible();
  };

  await crearCumple('Ana Perez', '1995-12-20');
  await crearCumple('Bruno Diaz', '1990-03-05');

  // Mi cumpleaños: se crea y se marca.
  await page.getByLabel('Agregar evento').click();
  await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Mi cumple');
  await page.getByText('Cumpleaños', { exact: true }).last().click();
  await page.getByLabel('Fecha').fill('1996-08-10');
  // La edad se calcula sola desde la fecha.
  await expect(page.getByLabel('Edad que cumple este año')).toHaveValue('30');
  await page.getByLabel('Este es mi cumpleaños').click();
  await page.getByText('Crear evento').click();

  // El modal de "nuevo evento" tarda un instante en cerrarse: si tocamos antes,
  // el click se pierde en la transición.
  await expect(page.getByText('Crear evento')).toHaveCount(0);

  // Entramos a la lista de saludos desde el detalle.
  await page.getByText('Mi cumple').first().click();
  await page.getByLabel('Ver quién me saludó').click();

  await expect(page.getByText(/¿Quién me saludó en \d{4}\?/)).toBeVisible();
  await expect(page.getByText('Te saludaron 0 de 2')).toBeVisible();
  // Mi propio cumpleaños no está en la lista (la pantalla anterior sigue montada
  // detrás, así que no alcanza con buscar el texto: se busca su fila tildable).
  await expect(page.getByLabel('Marcar saludo de Mi cumple')).toHaveCount(0);

  // Tildamos a Ana.
  await page.getByLabel('Marcar saludo de Ana Perez').click();
  await expect(page.getByText('Te saludaron 1 de 2')).toBeVisible();

  // Sumamos a alguien que no está en la agenda.
  await page.getByLabel('Nombre de quien me saludó').fill('Elena Sosa');
  await page.getByLabel('Sumar a la lista').click();
  await expect(page.getByText('Te saludaron 2 de 3')).toBeVisible();
  await expect(page.getByText('No está en tu agenda')).toBeVisible();

  // Al recargar, los saludos siguen guardados.
  await page.reload();
  await expect(page.getByText('Te saludaron 2 de 3')).toBeVisible();
});
