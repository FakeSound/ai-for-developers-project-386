/**
 * Сценарии владельца календаря: список встреч и навигация.
 * Описание — docs/scenarios.md.
 */

import { expect, test, uniqueGuestName } from "../fixtures/test";
import { plainDateOf, timeRangeLabel } from "../fixtures/ui";

test("В-3: встречи сгруппированы по дням и показывают гостя", async ({ page, api }) => {
  // Сид-брони привязаны к текущему времени и на вечернем прогоне могут
  // не создаться (backend/app/seed.py пропускает прошедшие), поэтому
  // сценарий заводит собственную бронь.
  const guestName = uniqueGuestName("Владелец Проверяет");
  const slot = await api.firstFreeSlot("konsultaciya");
  const booking = await api.createBooking({
    eventTypeId: "konsultaciya",
    startsAt: slot.startsAt,
    guest: { name: guestName, email: "owner-check@example.com" },
    notes: "Проверка списка встреч.",
  });

  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { level: 1, name: "Предстоящие встречи" }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ встреч(а|и)?\./)).toBeVisible();

  const row = page.getByRole("listitem").filter({ hasText: guestName });
  await expect(row).toBeVisible();
  await expect(row).toContainText(timeRangeLabel(booking.startsAt, booking.endsAt));
  await expect(row.getByText("Консультация")).toBeVisible();
  await expect(row.getByText("1 час")).toBeVisible();
  await expect(row.getByText("Проверка списка встреч.")).toBeVisible();

  // Встреча попала в секцию своего дня, а не в общий список.
  const date = plainDateOf(booking.startsAt);
  const section = page.locator("section").filter({ has: row });
  const dayHeading = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  await expect(section.getByRole("heading", { level: 2 })).toHaveText(dayHeading);
});

test("В-4: навигация ведёт по разделам приложения", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation");

  await nav.getByRole("link", { name: "Встречи" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Предстоящие встречи" }),
  ).toBeVisible();

  await nav.getByRole("link", { name: "Типы событий" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Типы событий" })).toBeVisible();

  await nav.getByRole("link", { name: "Запись" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Записаться на встречу" }),
  ).toBeVisible();
});
