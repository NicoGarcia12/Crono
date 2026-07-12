import { expect, test } from '@playwright/test';

/**
 * Un cumpleaños con teléfono ofrece saludar por WhatsApp desde su detalle,
 * con el link de wa.me y el saludo ya escrito.
 */
test('el cumpleaños con teléfono ofrece saludar por WhatsApp', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  // Cumpleaños con teléfono.
  await page.getByLabel('Agregar evento').click();
  await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Ana Perez');
  await page.getByText('Cumpleaños', { exact: true }).last().click();
  await page.getByLabel('Teléfono').fill('+54 9 11 5555-0001');
  await page.getByLabel('Fecha').fill('1995-12-20');
  await page.getByText('Crear evento').click();

  // Abrimos su detalle: el botón está.
  await page.getByText('Ana Perez').first().click();
  const boton = page.getByLabel('Saludar por WhatsApp');
  await expect(boton).toBeVisible();

  // En web, Linking.openURL abre una pestaña nueva. wa.me redirige a
  // api.whatsapp.com, así que verificamos el número y el saludo, no el dominio.
  const [popup] = await Promise.all([page.waitForEvent('popup'), boton.click()]);
  // WhatsApp codifica los espacios como '+' en su redirección.
  const url = decodeURIComponent(popup.url()).replace(/\+/g, ' ');
  expect(url).toContain('5491155550001');
  expect(url).toContain('Feliz cumple, Ana');
});

test('un evento sin teléfono no muestra el botón', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  await page.getByLabel('Agregar evento').click();
  await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Cena con amigos');
  await page.getByText('Crear evento').click();

  await page.getByText('Cena con amigos').first().click();

  await expect(page.getByLabel('Saludar por WhatsApp')).toHaveCount(0);
});
