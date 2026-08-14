import { defineConfig, devices } from '@playwright/test';

/**
 * E2E con Playwright sobre la versión WEB de Crono (react-native-web).
 *
 * 💡 Aprendizaje: `webServer` levanta la app sola antes de los tests (y la
 * reusa si ya está corriendo). Cada test corre en un contexto de navegador
 * limpio: la BD SQLite de web (OPFS) arranca vacía en cada test, así los
 * tests no dependen uno del otro.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // los tests comparten el dev server; de a uno es más estable
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 120_000, // el primer bundle de Metro puede tardar
  use: {
    baseURL: 'http://localhost:8082',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Viewport de celular: es como realmente se usa Crono.
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx expo start --web --port 8082',
    url: 'http://localhost:8082',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { CI: '1', EXPO_NO_TELEMETRY: '1' },
  },
});
