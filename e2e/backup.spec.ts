import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Ciclo completo de la copia de seguridad: exportar un evento, empezar de cero
 * (contexto nuevo = base vacía) y restaurarlo desde el archivo exportado.
 */
test('exporta la agenda y la restaura en un celular vacío', async ({ page, context }) => {
  await page.goto('/');
  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  await page.getByLabel('Agregar evento').click();
  await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Cumple de mamá');
  await page.getByText('Cumpleaños', { exact: true }).last().click();
  await page.getByLabel('Fecha').fill('1965-07-20');
  await page.getByText('Crear evento').click();
  await expect(page.getByText('Cumple de mamá').first()).toBeVisible();

  // Exportar: en web se descarga el archivo.
  await page.getByText('Perfil').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByLabel('Exportar copia de seguridad').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^crono-backup-\d{4}-\d{2}-\d{2}\.json$/);

  const rutaBackup = await download.path();
  const contenido = JSON.parse(readFileSync(rutaBackup, 'utf8'));
  expect(contenido.app).toBe('crono');
  expect(contenido.events[0]).toMatchObject({ title: 'Cumple de mamá', type: 'cumpleanos' });

  // "Otro celular": página nueva con la base vacía (otro contexto de navegador).
  const otro = await context.browser()!.newPage();
  await otro.goto('http://localhost:8082/');
  await otro.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await otro.getByText('Empezar').click();
  await expect(otro.getByText('Todavía no hay nada agendado')).toBeVisible();

  // Restaurar desde el archivo descargado (el selector de archivos del navegador).
  await otro.getByText('Perfil').click();
  const fileChooserPromise = otro.waitForEvent('filechooser');
  await otro.getByLabel('Restaurar desde un archivo').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(rutaBackup);

  // El evento vuelve a estar en la agenda (la palabra "agenda" aparece en varios
  // textos de la pantalla, así que apuntamos a la pestaña por su rol).
  await otro.getByRole('tab', { name: /Agenda/ }).click();
  await expect(otro.getByText('Cumple de mamá').first()).toBeVisible({ timeout: 15000 });
});
