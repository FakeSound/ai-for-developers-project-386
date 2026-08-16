/**
 * Общий `test` для всех спеков: базовый Playwright плюс фикстура `api`.
 *
 * Спеки импортируют `test` и `expect` отсюда, а не из @playwright/test.
 */

import { test as base, expect } from "@playwright/test";

import { ApiClient } from "./api";

export const test = base.extend<{ api: ApiClient }>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export { expect };

/**
 * Уникальный идентификатор для данных, которые тест создаёт в общем
 * хранилище: бэкенд держит состояние в памяти и не откатывает его между
 * тестами, поэтому имена не должны сталкиваться между прогонами.
 *
 * Формат подходит под ограничение `EventTypeCreate.id`
 * (`^[a-z0-9]+(-[a-z0-9]+)*$`).
 */
export function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
}

/** Читаемая метка для гостя, чтобы отличать записи разных тестов. */
export function uniqueGuestName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}
