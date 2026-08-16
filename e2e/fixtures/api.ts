/**
 * Клиент API для e2e: подготовка состояния и проверки мимо интерфейса.
 *
 * Тесты гоняют пользовательские сценарии через браузер, но некоторые
 * предусловия через интерфейс не собрать — например, занять слот в тот
 * момент, когда гость уже заполняет форму. Для таких шагов ходим в API
 * напрямую, тем же адресом, что и приложение.
 *
 * Типы берутся из контракта (`main.tsp` -> openapi.yaml -> schema.d.ts),
 * а не переписываются здесь: разойтись с бэкендом молча не получится.
 */

import { expect, type APIRequestContext } from "@playwright/test";

import type {
  Booking,
  BookingCreate,
  EventType,
  EventTypeCreate,
  Owner,
  Slot,
  SlotsPage,
} from "../../frontend/src/api/types";

const API = "/api/v1";

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async owner(): Promise<Owner> {
    return this.get<Owner>(`${API}/owner`);
  }

  async eventTypes(): Promise<EventType[]> {
    return this.get<EventType[]>(`${API}/event-types`);
  }

  async slots(eventTypeId: string): Promise<SlotsPage> {
    return this.get<SlotsPage>(`${API}/event-types/${eventTypeId}/slots`);
  }

  async bookings(): Promise<Booking[]> {
    return this.get<Booking[]>(`${API}/admin/bookings`);
  }

  /**
   * Первый свободный слот окна записи — он же самый ранний в своём дне.
   * Повторяет `first_free_slot` из backend/tests/conftest.py.
   */
  async firstFreeSlot(eventTypeId: string): Promise<Slot> {
    const page = await this.slots(eventTypeId);
    for (const day of page.days) {
      const [slot] = day.slots;
      if (slot) return slot;
    }
    throw new Error(`нет свободных слотов для «${eventTypeId}»`);
  }

  /** Свободный слот, следующий за уже занятым: нужен, когда первый забирает UI. */
  async freeSlotAfter(eventTypeId: string, startsAt: string): Promise<Slot> {
    const page = await this.slots(eventTypeId);
    const slots = page.days.flatMap((day) => day.slots);
    const slot = slots.find((candidate) => candidate.startsAt > startsAt);
    if (!slot) throw new Error(`после ${startsAt} свободных слотов нет`);
    return slot;
  }

  async createBooking(booking: BookingCreate): Promise<Booking> {
    const response = await this.request.post(`${API}/bookings`, {
      data: booking,
    });
    expect(
      response.ok(),
      `POST /bookings -> ${response.status()}: ${await response.text()}`,
    ).toBeTruthy();
    return response.json() as Promise<Booking>;
  }

  async createEventType(eventType: EventTypeCreate): Promise<EventType> {
    const response = await this.request.post(`${API}/event-types`, {
      data: eventType,
    });
    expect(
      response.ok(),
      `POST /event-types -> ${response.status()}: ${await response.text()}`,
    ).toBeTruthy();
    return response.json() as Promise<EventType>;
  }

  private async get<T>(path: string): Promise<T> {
    const response = await this.request.get(path);
    expect(
      response.ok(),
      `GET ${path} -> ${response.status()}: ${await response.text()}`,
    ).toBeTruthy();
    return response.json() as Promise<T>;
  }
}
