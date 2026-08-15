/**
 * Типизированный клиент API, построенный прямо на контракте.
 *
 * `baseUrl` совпадает с `@server(...)` из main.tsp; в разработке Vite
 * проксирует `/api/v1` на мок Prism, поэтому переключение на настоящий бэкенд
 * не требует правок в коде.
 */

import createClient from "openapi-fetch";

import { networkError, toApiError } from "./errors";
import type { paths } from "./schema";

export const client = createClient<paths>({
  baseUrl: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// ---------------------------------------------------------------------------
// Заголовок Prefer для мок-сервера
// ---------------------------------------------------------------------------

/**
 * Prism не хранит состояние и без подсказки отдаёт первый пример из спеки.
 * Заголовок `Prefer` — его штатный механизм выбора конкретного примера
 * и кода ответа, им и пользуемся, пока API отдаёт мок.
 *
 * Настоящему бэкенду заголовок безразличен, но лишним его не шлём:
 * поведение включается флагом `VITE_MOCK`.
 */
const MOCK_ENABLED = import.meta.env.VITE_MOCK === "true";

export function preferHeader(options: {
  example?: string;
  code?: number;
}): Record<string, string> {
  if (!MOCK_ENABLED) return {};

  const parts: string[] = [];
  if (options.code) parts.push(`code=${options.code}`);
  if (options.example) parts.push(`example=${options.example}`);
  return parts.length > 0 ? { Prefer: parts.join(", ") } : {};
}

export const isMockMode = MOCK_ENABLED;

// ---------------------------------------------------------------------------
// Обёртка вокруг openapi-fetch
// ---------------------------------------------------------------------------

type FetchResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/**
 * Превращает результат openapi-fetch в значение или брошенный `ApiError`,
 * как этого ждёт TanStack Query.
 */
export async function unwrap<T>(
  request: Promise<FetchResult<T>>,
): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch {
    throw networkError();
  }

  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.error, result.response.status);
  }

  return result.data as T;
}
