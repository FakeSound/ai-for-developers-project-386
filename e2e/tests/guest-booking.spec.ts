/**
 * Сценарии гостя: от списка видов встреч до созданной брони.
 * Описание сценариев — docs/scenarios.md.
 */

import { expect, test, uniqueGuestName } from "../fixtures/test";
import {
  dialog,
  fillGuestForm,
  openEventType,
  plainDateOf,
  selectDay,
  slotButton,
  slotButtons,
  timeLabel,
  timeRangeLabel,
} from "../fixtures/ui";

test("Г-1: гость видит виды встреч с длительностью", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Записаться на встречу" }),
  ).toBeVisible();
  await expect(page.getByRole("banner").getByText("Анна Смирнова")).toBeVisible();

  // Точное количество не проверяем: другие сценарии добавляют свои типы.
  const expected = [
    { title: "Знакомство", duration: "30 минут" },
    { title: "Консультация", duration: "1 час" },
    { title: "Быстрый звонок", duration: "15 минут" },
  ];

  for (const { title, duration } of expected) {
    const card = page.locator("[data-slot=card]", { hasText: title });
    await expect(card.getByRole("link", { name: title })).toBeVisible();
    await expect(card.getByText(duration)).toBeVisible();
  }
});

test("Г-2: страница вида встречи открывается на ближайшем свободном дне", async ({
  page,
  api,
}) => {
  const slot = await api.firstFreeSlot("znakomstvo");

  await page.goto("/");
  await page.getByRole("link", { name: "Знакомство" }).click();

  // Пояс подписан и в шапке приложения, и на самой странице — смотрим страницу.
  const content = page.getByRole("main");
  await expect(content.getByRole("heading", { level: 1, name: "Знакомство" })).toBeVisible();
  await expect(content.getByText("30 минут")).toBeVisible();
  await expect(content.getByText("Europe/Moscow · GMT+3")).toBeVisible();

  // Календарь открыт на первом дне окна, где вообще есть свободное время,
  // и самое раннее время этого дня показано первым.
  await expect(page.locator('td[data-selected="true"]')).toHaveAttribute(
    "data-day",
    plainDateOf(slot.startsAt),
  );
  await expect(slotButtons(page).first()).toHaveText(timeLabel(slot.startsAt));
  await expect(page.getByText(/\d+ слот(а|ов)?$/)).toBeVisible();
});

test.describe.serial("Сквозной сценарий гостя", () => {
  const guest = {
    name: uniqueGuestName("Гость Тестов"),
    email: "guest@example.com",
    notes: "Хочу обсудить настройку CI.",
  };

  /** Что именно забронировал Г-3 — проверяют Г-4 и Г-5. */
  let bookedDate: string;
  let bookedTime: string;

  test("Г-3: гость бронирует слот и получает подтверждение", async ({ page, api }) => {
    const slot = await api.firstFreeSlot("znakomstvo");
    bookedDate = plainDateOf(slot.startsAt);
    bookedTime = timeLabel(slot.startsAt);

    await openEventType(page, "znakomstvo", "Знакомство");
    await slotButton(page, bookedTime).click();

    const form = dialog(page);
    await expect(form.getByText("Подтвердите запись")).toBeVisible();
    await expect(form.getByText("Знакомство")).toBeVisible();

    await fillGuestForm(page, guest);
    await form.getByRole("button", { name: "Записаться" }).click();

    const confirmation = dialog(page);
    await expect(confirmation.getByText("Встреча забронирована")).toBeVisible();
    await expect(
      confirmation.getByText(`Подтверждение отправлено на ${guest.email}`),
    ).toBeVisible();
    await expect(confirmation.getByText(guest.name)).toBeVisible();
    await expect(confirmation.getByText(guest.notes)).toBeVisible();
    await expect(
      confirmation.getByText(timeRangeLabel(slot.startsAt, slot.endsAt)),
    ).toBeVisible();

    await confirmation.getByRole("button", { name: "Готово" }).click();
    await expect(confirmation).toBeHidden();
  });

  test("Г-4: забронированное время исчезает из календаря", async ({ page }) => {
    await openEventType(page, "znakomstvo", "Знакомство");
    await selectDay(page, bookedDate);

    await expect(slotButton(page, bookedTime)).toBeHidden();

    // Слот пропал не только из обновлённого кэша, но и из ответа сервера.
    await page.reload();
    await expect(slotButtons(page).first()).toBeVisible();
    await selectDay(page, bookedDate);
    await expect(slotButton(page, bookedTime)).toBeHidden();
  });

  test("Г-5: бронь гостя видна владельцу в списке встреч", async ({ page }) => {
    await page.goto("/admin");

    await expect(
      page.getByRole("heading", { level: 1, name: "Предстоящие встречи" }),
    ).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: guest.name });
    await expect(row).toBeVisible();
    await expect(row.getByText("Знакомство")).toBeVisible();
    await expect(row.getByText(guest.email)).toBeVisible();
    await expect(row.getByText(guest.notes)).toBeVisible();
    await expect(row).toContainText(bookedTime);
  });
});

test("Г-6: слот, занятый во время заполнения формы, отдаёт конфликт", async ({
  page,
  api,
}) => {
  const slot = await api.firstFreeSlot("bystryj-zvonok");
  const time = timeLabel(slot.startsAt);

  await openEventType(page, "bystryj-zvonok", "Быстрый звонок");
  await slotButton(page, time).click();
  await expect(dialog(page).getByText("Подтвердите запись")).toBeVisible();

  // Пока гость заполняет форму, это же время занимает кто-то другой —
  // настоящий 409 от бэкенда, без подмены ответа в тесте.
  await api.createBooking({
    eventTypeId: "znakomstvo",
    startsAt: slot.startsAt,
    guest: { name: "Кто-то Быстрее", email: "faster@example.com" },
  });

  await fillGuestForm(page, { name: "Гость Опоздал", email: "late@example.com" });
  await dialog(page).getByRole("button", { name: "Записаться" }).click();

  await expect(page.getByText("Это время уже заняли")).toBeVisible();
  await expect(dialog(page)).toBeHidden();

  // Календарь перезапрошен: занятого времени в сетке больше нет.
  await selectDay(page, plainDateOf(slot.startsAt));
  await expect(slotButton(page, time)).toBeHidden();
});
