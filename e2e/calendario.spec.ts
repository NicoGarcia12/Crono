import { expect, test } from '@playwright/test';

function localIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function calendarDayLabel(date: Date): string {
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  return `Día ${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
}

/**
 * Flujo crítico del calendario: un evento creado aparece en su día, la
 * navegación entre meses funciona y la vista semanal también.
 */
test('el evento creado aparece en el calendario y se puede navegar', async ({ page }) => {
  // Una fecha calculada al ejecutar evita que el escenario venza al pasar 2026.
  const today = new Date();
  const eventDate = localIso(today);
  const dayLabel = calendarDayLabel(today);

  await page.goto('/');

  await page.getByPlaceholder('¿Cómo te llamás?').fill('Nico');
  await page.getByText('Empezar').click();

  // Creamos un evento para hoy, que es el período inicial del calendario.
  await page.getByLabel('Agregar evento').click();
  await page.getByPlaceholder('Ej: Cumpleaños de mamá').fill('Cena con amigos');
  await page.getByLabel('Fecha').fill(eventDate);
  await page.getByText('Crear evento').click();
  await expect(page.getByText('Cena con amigos').first()).toBeVisible();

  await page.getByText('Calendario').click();

  // La navegación no depende de un mes/año hardcodeado: volvemos al período actual.
  await page.getByLabel('Período anterior').click();
  await page.getByLabel('Ir a hoy').click();

  // Tocamos el día creado: abajo se lista el evento dentro del detalle diario.
  await page.getByLabel(dayLabel).click();
  await expect(page.getByTestId('lista-virtualizada-eventos-del-dia').getByText('Cena con amigos')).toBeVisible();

  // La vista semanal muestra el rango de esa semana.
  await page.getByLabel('Vista semanal').click();
  await expect(page.getByLabel(dayLabel)).toBeVisible();
});
