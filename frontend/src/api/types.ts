/**
 * Удобные псевдонимы для типов из контракта.
 *
 * `schema.d.ts` генерируется из `openapi/openapi.yaml` командой `npm run gen:api`
 * в корне репозитория и вручную не правится.
 */

import type { components } from "./schema";

type Schemas = components["schemas"];

export type Owner = Schemas["Owner"];
export type Weekday = Schemas["Weekday"];
export type EventType = Schemas["EventType"];
export type EventTypeCreate = Schemas["EventTypeCreate"];
export type EventTypeSummary = Schemas["EventTypeSummary"];
export type Slot = Schemas["Slot"];
export type DaySlots = Schemas["DaySlots"];
export type SlotsPage = Schemas["SlotsPage"];
export type Guest = Schemas["Guest"];
export type Booking = Schemas["Booking"];
export type BookingCreate = Schemas["BookingCreate"];
export type ApiErrorBody = Schemas["ApiError"];
export type ErrorCode = Schemas["ErrorCode"];
