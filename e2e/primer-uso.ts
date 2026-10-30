import { expect, type Page } from '@playwright/test';

/**
 * Pasos compartidos del primer uso en web. No es un spec (no termina en
 * `.spec.ts`), así que Playwright no lo corre como test.
 */

/**
 * Acepta seguir sin bloqueo (web no tiene bloqueo local), carga el nombre y
 * toca "Empezar". En web no hay diálogo de avisos (no hay recordatorios), así
 * que la app queda en Agenda con el recorrido de primer uso abierto.
 */
export async function completarBienvenida(page: Page, nombre = 'Nico') {
  await page.getByRole('button', { name: 'Continuar sin bloqueo' }).click();
  await page.getByPlaceholder('¿Cómo te llamás?').fill(nombre);
  await page.getByText('Empezar').click();
}

/** Cierra el recorrido guiado (CRONO44): mientras está abierto tapa la Agenda. */
export async function saltarRecorrido(page: Page) {
  const saltar = page.getByRole('button', { name: 'Saltar recorrido' });
  await saltar.click();
  await expect(saltar).toHaveCount(0);
}

/** Primer uso completo para specs que no prueban el recorrido: bienvenida + saltarlo. */
export async function empezarSinRecorrido(page: Page, nombre = 'Nico') {
  await completarBienvenida(page, nombre);
  await saltarRecorrido(page);
}
