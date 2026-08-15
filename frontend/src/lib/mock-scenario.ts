/**
 * Выбор сценария ответа мока для `POST /bookings`.
 *
 * На stateless-моке настоящий конфликт слотов возникнуть не может, поэтому
 * ветки ошибок из контракта иначе остались бы непроверяемыми. Значение
 * переезжает в заголовок `Prefer` и работает только в режиме мока.
 */

import { useSyncExternalStore } from "react";

export type BookingScenario =
  | "success"
  | "slot_taken"
  | "slot_not_in_grid"
  | "slot_out_of_window"
  | "not_found";

export const BOOKING_SCENARIOS: { value: BookingScenario; label: string }[] = [
  { value: "success", label: "Успешная запись" },
  { value: "slot_taken", label: "409 — слот заняли" },
  { value: "slot_not_in_grid", label: "409 — не по сетке" },
  { value: "slot_out_of_window", label: "409 — вне окна записи" },
  { value: "not_found", label: "404 — тип события не найден" },
];

let current: BookingScenario = "success";
const listeners = new Set<() => void>();

export function setBookingScenario(scenario: BookingScenario) {
  current = scenario;
  listeners.forEach((listener) => listener());
}

export function getBookingScenario(): BookingScenario {
  return current;
}

export function useBookingScenario(): BookingScenario {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getBookingScenario,
  );
}

/** Параметры `Prefer` для выбранного сценария. */
export function scenarioPrefer(
  scenario: BookingScenario,
  eventTypeId: string,
): { example?: string; code?: number } {
  switch (scenario) {
    case "success":
      // Пример подбирается по типу события, чтобы карточка в подтверждении
      // соответствовала тому, что бронировал гость.
      return { example: eventTypeId, code: 201 };
    case "not_found":
      return { example: "not_found", code: 404 };
    default:
      return { example: scenario, code: 409 };
  }
}
