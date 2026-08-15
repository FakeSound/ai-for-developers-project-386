/**
 * Хуки доступа к API. Каждый соответствует одной операции контракта.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { getBookingScenario, scenarioPrefer } from "@/lib/mock-scenario";

import { client, preferHeader, unwrap } from "./client";
import type { ApiError } from "./errors";
import type {
  Booking,
  BookingCreate,
  EventType,
  EventTypeCreate,
  Owner,
  SlotsPage,
} from "./types";

export const queryKeys = {
  owner: ["owner"] as const,
  eventTypes: ["event-types"] as const,
  eventType: (id: string) => ["event-types", id] as const,
  slots: (id: string) => ["event-types", id, "slots"] as const,
  adminBookings: ["admin", "bookings"] as const,
};

/** GET /owner */
export function useOwner() {
  return useQuery<Owner, ApiError>({
    queryKey: queryKeys.owner,
    queryFn: () => unwrap(client.GET("/owner")),
    staleTime: Infinity,
  });
}

/** GET /event-types */
export function useEventTypes() {
  return useQuery<EventType[], ApiError>({
    queryKey: queryKeys.eventTypes,
    queryFn: () => unwrap(client.GET("/event-types")),
  });
}

/** GET /event-types/{id} */
export function useEventType(id: string) {
  return useQuery<EventType, ApiError>({
    queryKey: queryKeys.eventType(id),
    queryFn: () =>
      unwrap(
        client.GET("/event-types/{id}", {
          params: { path: { id } },
          headers: preferHeader({ example: id }),
        }),
      ),
    enabled: Boolean(id),
  });
}

/**
 * GET /event-types/{id}/slots
 *
 * Без `from`/`to` сервер отдаёт всё окно записи целиком — ровно то,
 * что нужно календарю гостя.
 */
export function useSlots(id: string) {
  return useQuery<SlotsPage, ApiError>({
    queryKey: queryKeys.slots(id),
    queryFn: () =>
      unwrap(
        client.GET("/event-types/{id}/slots", {
          params: { path: { id } },
          headers: preferHeader({ example: id }),
        }),
      ),
    enabled: Boolean(id),
  });
}

/** GET /admin/bookings */
export function useAdminBookings() {
  return useQuery<Booking[], ApiError>({
    queryKey: queryKeys.adminBookings,
    queryFn: () => unwrap(client.GET("/admin/bookings")),
  });
}

/**
 * POST /bookings
 *
 * При 409 `slot_taken` контракт предписывает перезапросить календарь:
 * слот заняли между выбором и отправкой формы.
 */
export function useCreateBooking(
  options?: Pick<
    UseMutationOptions<Booking, ApiError, BookingCreate>,
    "onSuccess" | "onError"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<Booking, ApiError, BookingCreate>({
    mutationFn: (booking) =>
      unwrap(
        client.POST("/bookings", {
          body: booking,
          headers: preferHeader(
            scenarioPrefer(getBookingScenario(), booking.eventTypeId),
          ),
        }),
      ),
    onSuccess: (booking, variables, ...rest) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.slots(variables.eventTypeId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.adminBookings });
      options?.onSuccess?.(booking, variables, ...rest);
    },
    onError: (error, variables, ...rest) => {
      if (error.is("slot_taken")) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.slots(variables.eventTypeId),
        });
      }
      options?.onError?.(error, variables, ...rest);
    },
  });
}

/** POST /event-types */
export function useCreateEventType(
  options?: Pick<
    UseMutationOptions<EventType, ApiError, EventTypeCreate>,
    "onSuccess" | "onError"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<EventType, ApiError, EventTypeCreate>({
    mutationFn: (eventType) =>
      unwrap(client.POST("/event-types", { body: eventType })),
    onSuccess: (created, variables, ...rest) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.eventTypes });
      options?.onSuccess?.(created, variables, ...rest);
    },
    onError: options?.onError,
  });
}
