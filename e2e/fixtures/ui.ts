/**
 * Локаторы и форматирование, общие для сценариев.
 *
 * Селекторы строятся на ролях и видимом тексте — специальных `data-testid`
 * в приложении нет и не заводим: формы связаны через `label`/`htmlFor`,
 * слоты и дни календаря доступны как кнопки.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/** Совпадает с `OWNER.time_zone` из backend/app/config.py. */
export const OWNER_TIME_ZONE = "Europe/Moscow";

const LOCALE = "ru-RU";

// ---------------------------------------------------------------------------
// Ожидаемые подписи
//
// Считаются здесь независимо от frontend/src/lib/datetime.ts: если формат
// в приложении поедет, тест это увидит, а не подстроится.
// ---------------------------------------------------------------------------

/** `2026-08-17T07:00:00Z` -> `10:00`. */
export function timeLabel(instant: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: OWNER_TIME_ZONE,
  }).format(new Date(instant));
}

/** `10:00 – 10:30`, с тем же длинным тире, что и в приложении. */
export function timeRangeLabel(startsAt: string, endsAt: string): string {
  return `${timeLabel(startsAt)} – ${timeLabel(endsAt)}`;
}

/** Календарная дата момента в поясе владельца: `2026-08-17`. */
export function plainDateOf(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: OWNER_TIME_ZONE,
  }).format(new Date(instant));
}

// ---------------------------------------------------------------------------
// Локаторы
// ---------------------------------------------------------------------------

/**
 * Кнопка дня в календаре записи.
 *
 * `data-day` с датой в ISO проставляет сам react-day-picker — по нему день
 * находится однозначно, в отличие от номера или подписи «17 августа».
 */
export function calendarDay(page: Page, date: string): Locator {
  return page.locator(`td[data-day="${date}"] button`);
}

/** Кнопка свободного времени: `10:00`. */
export function slotButton(page: Page, time: string): Locator {
  return page.getByRole("button", { name: time, exact: true });
}

/** Все кнопки времени выбранного дня. */
export function slotButtons(page: Page): Locator {
  return page.getByRole("group", { name: /^Свободное время на / }).getByRole("button");
}

export function dialog(page: Page): Locator {
  return page.getByRole("dialog");
}

// ---------------------------------------------------------------------------
// Шаги
// ---------------------------------------------------------------------------

/** Открывает страницу вида встречи и дожидается загрузки календаря. */
export async function openEventType(page: Page, id: string, title: string) {
  await page.goto(`/event-types/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(slotButtons(page).first()).toBeVisible();
}

/** Выбирает день окна записи и дожидается, пока обновится список времени. */
export async function selectDay(page: Page, date: string) {
  const day = calendarDay(page, date);
  await expect(
    day,
    `день ${date} должен быть доступен для записи`,
  ).toBeEnabled();
  await day.click();
}

/** Заполняет форму гостя в открытом диалоге. */
export async function fillGuestForm(
  page: Page,
  guest: { name: string; email: string; notes?: string },
) {
  const form = dialog(page);
  await form.getByLabel("Имя").fill(guest.name);
  await form.getByLabel("Email").fill(guest.email);
  if (guest.notes !== undefined) {
    await form.getByLabel("Комментарий").fill(guest.notes);
  }
}
