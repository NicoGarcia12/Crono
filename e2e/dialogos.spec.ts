import { expect, test } from '@playwright/test';

/**
 * Diálogos propios: en web antes se usaba el `confirm` del navegador. Ahora
 * es un diálogo de Crono dentro de la página, así que se maneja como
 * cualquier otro elemento (sin `page.on('dialog')`).
 */
test.describe('Diálogos propios', () => {
  test('borrar un evento pide confirmación: cancelar lo deja, confirmar lo borra', async ({ page }) => {
    await page.goto('/');

    await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
    await page.getByText('Empezar').click();

    await page.getByLabel('Agregar evento').click();
    await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Cena con amigos');
    await page.getByLabel('Fecha').fill('2026-12-20');
    await page.getByText('Crear evento').click();
    await page.getByText('Cena con amigos').click();

    // Cancelar: el diálogo se cierra y el evento sigue ahí.
    await page.getByLabel('Borrar evento').click();
    await expect(page.getByText('¿Seguro que querés eliminar "Cena con amigos"?')).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('¿Seguro que querés eliminar "Cena con amigos"?')).toHaveCount(0);

    // Confirmar: vuelve a la agenda sin el evento.
    await page.getByLabel('Borrar evento').click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(page.getByText('Todavía no hay nada agendado')).toBeVisible();
  });
});
