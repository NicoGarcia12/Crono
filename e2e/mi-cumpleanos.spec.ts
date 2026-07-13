import { expect, test } from '@playwright/test';

/**
 * Mi cumpleaños se carga en el Perfil. Desde ahí (o entrando al evento en la
 * agenda) se llega a la lista de quién me saludó ese año.
 */
test('carga mi cumpleaños desde el perfil y registra quién me saludó', async ({ page }) => {
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
    // El modal tarda un instante en cerrarse: si tocamos antes, el click se pierde.
    await expect(page.getByText('Crear evento')).toHaveCount(0);
  };

  await crearCumple('Ana Perez', '1995-12-20');
  await crearCumple('Bruno Diaz', '1990-03-05');

  // Mi cumpleaños: se carga en el Perfil.
  await page.getByText('Perfil').click();
  await expect(page.getByText('Cargalo para poder anotar quién te saluda cada año')).toBeVisible();
  await page.getByLabel('Fecha').fill('1996-08-10');
  await page.getByLabel('Guardar mi cumpleaños').click();

  // Queda cargado con su fecha y su edad.
  await expect(page.getByText(/10 de agosto de 1996 · cumplís \d+ este año/)).toBeVisible();

  // Y se creó el evento en la agenda, marcado como propio.
  await page.getByRole('tab', { name: /Agenda/ }).click();
  await expect(page.getByText('Cumpleaños de Nico')).toBeVisible();

  // Entrando al evento se llega a la lista.
  await page.getByText('Cumpleaños de Nico').click();
  await expect(page.getByText('Guardar cambios')).toBeVisible();
  await page.getByLabel('Ver quién me saludó').last().click();

  await expect(page.getByText(/¿Quién me saludó en \d{4}\?/)).toBeVisible();
  await expect(page.getByText('Te saludaron 0 de 2')).toBeVisible();
  // Mi propio cumpleaños no está en la lista.
  await expect(page.getByLabel('Marcar saludo de Cumpleaños de Nico')).toHaveCount(0);

  // Tildamos a Ana y sumamos a alguien que no está en la agenda.
  await page.getByLabel('Marcar saludo de Ana Perez').click();
  await page.getByLabel('Nombre de quien me saludó').fill('Elena Sosa');
  await page.getByLabel('Sumar a la lista').click();
  await expect(page.getByText('Te saludaron 2 de 3')).toBeVisible();
  await expect(page.getByText('No está en tu agenda')).toBeVisible();

  // Al recargar, los saludos siguen guardados.
  await page.reload();
  await expect(page.getByText('Te saludaron 2 de 3')).toBeVisible();
});
