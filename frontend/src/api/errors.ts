/**
 * Приведение любых сбоев запроса к одной форме и русские тексты для `ErrorCode`.
 */

import type { ApiErrorBody, ErrorCode } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | "network_error" | "unknown";
  readonly details?: Record<string, unknown>;

  constructor(init: {
    status: number;
    code: ApiError["code"];
    message: string;
    details?: Record<string, unknown>;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
  }

  is(code: ErrorCode) {
    return this.code === code;
  }
}

/** Сообщения по умолчанию, если сервер не прислал своё. */
const MESSAGE_BY_CODE: Record<ErrorCode, string> = {
  validation_failed: "Проверьте заполненные поля — сервер их не принял.",
  not_found: "Ресурс не найден.",
  event_type_exists: "Тип события с таким идентификатором уже существует.",
  slot_taken: "Это время уже занято. Выберите другой слот.",
  slot_not_in_grid: "Выбранное время не совпадает с сеткой слотов владельца.",
  slot_out_of_window: "Записаться можно только в пределах окна записи.",
};

const ERROR_CODES = Object.keys(MESSAGE_BY_CODE) as ErrorCode[];

const isErrorCode = (value: unknown): value is ErrorCode =>
  typeof value === "string" && ERROR_CODES.includes(value as ErrorCode);

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === "object" &&
  value !== null &&
  isErrorCode((value as ApiErrorBody).code);

/**
 * Разбирает тело ошибки.
 *
 * Кроме контрактного `ApiError` учитывает собственный формат Prism
 * (`{ type, title, status, detail }`), который приходит, например, когда
 * запрошенного маршрута нет в спеке.
 */
export function toApiError(body: unknown, status: number): ApiError {
  if (isApiErrorBody(body)) {
    return new ApiError({
      status,
      code: body.code,
      message: body.message || MESSAGE_BY_CODE[body.code],
      details: body.details,
    });
  }

  if (typeof body === "object" && body !== null) {
    const prism = body as { title?: string; detail?: string };
    if (prism.title || prism.detail) {
      return new ApiError({
        status,
        code: "unknown",
        message: prism.detail || prism.title || "Мок-сервер вернул ошибку.",
      });
    }
  }

  return new ApiError({
    status,
    code: "unknown",
    message: `Запрос завершился с ошибкой ${status}.`,
  });
}

export const networkError = () =>
  new ApiError({
    status: 0,
    code: "network_error",
    message:
      "Не удалось связаться с API. Проверьте, что мок-сервер запущен: npm run mock",
  });

/** Текст для показа пользователю. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Произошла непредвиденная ошибка.";
}
