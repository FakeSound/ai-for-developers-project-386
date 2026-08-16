/**
 * Интеграционные (e2e) тесты: настоящий бэкенд + собранный фронтенд.
 *
 * Проверяемые сценарии перечислены в docs/scenarios.md; идентификатор
 * сценария стоит в заголовке каждого теста.
 *
 * Приложение поднимает сам Playwright: uvicorn на 3000 и `vite preview`
 * на 4173, который проксирует на бэкенд /api/v1 — браузер, как и в проде
 * за nginx, ходит на один origin. Если в окружении задан E2E_BASE_URL,
 * ничего не поднимается и тесты идут по указанному адресу.
 */

import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;
const API_URL = "http://127.0.0.1:3000";
const externalBaseURL = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e/tests",

  // Хранилище бэкенда живёт в памяти одного процесса, а занятость календаря
  // глобальная: параллельные воркеры дрались бы за одни и те же слоты.
  fullyParallel: false,
  workers: 1,

  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL: externalBaseURL ?? `http://127.0.0.1:${PREVIEW_PORT}`,

    // Приложение форматирует время в поясе владельца (Europe/Moscow), но
    // календарь конвертирует даты через локальный пояс браузера. Совпадение
    // поясов убирает съезд на сутки, локаль фиксирует русские подписи дат.
    locale: "ru-RU",
    timezoneId: "Europe/Moscow",

    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: externalBaseURL
    ? undefined
    : [
        {
          // Без --reload: перезапуск процесса обнулил бы хранилище посреди прогона.
          command: "npm run api:ci",
          url: `${API_URL}/api/v1/owner`,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 60_000,
        },
        {
          // Сборка входит в команду, чтобы `npx playwright test` работал
          // одинаково локально и в CI, без отдельного шага.
          //
          // --host 127.0.0.1 обязателен: по умолчанию preview слушает
          // localhost и на машинах с IPv6 занимает только [::1], тогда как
          // uvicorn поднимается на 127.0.0.1.
          command: `npm --prefix frontend run build && npm --prefix frontend run preview -- --host 127.0.0.1 --port ${PREVIEW_PORT} --strictPort`,
          url: `http://127.0.0.1:${PREVIEW_PORT}`,
          reuseExistingServer: !process.env.CI,
          stdout: "pipe",
          stderr: "pipe",
          timeout: 180_000,
        },
      ],
});
