/**
 * Сценарии гостя, в которых что-то идёт не так: валидация формы
 * и несуществующие адреса. Описание — docs/scenarios.md.
 */

import { expect, test } from "../fixtures/test";
import { dialog, openEventType, slotButtons } from "../fixtures/ui";

test("Г-7: форма брони не пропускает пустое имя и неверную почту", async ({ page }) => {
  await openEventType(page, "konsultaciya", "Консультация");
  await slotButtons(page).first().click();

  const form = dialog(page);
  await expect(form.getByText("Подтвердите запись")).toBeVisible();

  await form.getByRole("button", { name: "Записаться" }).click();
  await expect(form.getByText("Укажите, как к вам обращаться")).toBeVisible();
  await expect(form.getByText("Похоже на опечатку в адресе почты")).toBeVisible();

  // Имя есть, почта всё ещё некорректная — записаться по-прежнему нельзя.
  await form.getByLabel("Имя").fill("Гость Невалидный");
  await form.getByLabel("Email").fill("не-почта");
  await form.getByRole("button", { name: "Записаться" }).click();

  await expect(form.getByText("Укажите, как к вам обращаться")).toBeHidden();
  await expect(form.getByText("Похоже на опечатку в адресе почты")).toBeVisible();

  // Диалог остался на шаге формы: подтверждения нет, бронь не создана.
  await expect(form.getByText("Подтвердите запись")).toBeVisible();
  await expect(page.getByText("Встреча забронирована")).toBeHidden();
});

test("Г-8: несуществующий вид встречи показывает понятную ошибку", async ({ page }) => {
  await page.goto("/event-types/net-takogo-vida");

  await expect(page.getByText("Такого вида встреч нет")).toBeVisible();
  await page.getByRole("link", { name: "К видам встреч" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Записаться на встречу" }),
  ).toBeVisible();
});

test("Г-9: неизвестный адрес возвращает на список видов встреч", async ({ page }) => {
  await page.goto("/takoy-stranicy-net");

  await expect(page.getByText("Страница не найдена")).toBeVisible();
  await page.getByRole("link", { name: "К видам встреч" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Записаться на встречу" }),
  ).toBeVisible();
});
