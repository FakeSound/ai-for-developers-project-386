/**
 * Сценарии владельца календаря: типы событий.
 * Описание — docs/scenarios.md.
 */

import { expect, test, uniqueId } from "../fixtures/test";
import { slotButtons } from "../fixtures/ui";

test("В-1: созданный тип события сразу доступен гостю", async ({ page }) => {
  const id = uniqueId("razbor");
  const title = `Разбор резюме ${id}`;

  await page.goto("/admin/event-types");
  await expect(page.getByRole("heading", { level: 1, name: "Типы событий" })).toBeVisible();

  const form = page.locator("form");
  await form.getByLabel("Идентификатор").fill(id);
  await form.getByLabel("Название").fill(title);
  await form.getByLabel("Описание").fill("Смотрим резюме и правим формулировки.");
  await form.getByLabel("Длительность, минут").fill("45");
  await form.getByRole("button", { name: "Создать" }).click();

  await expect(page.getByText("Тип события создан")).toBeVisible();

  const card = page.locator("[data-slot=card]", { hasText: title });
  await expect(card.getByText(id, { exact: true })).toBeVisible();
  await expect(card.getByText("45 минут")).toBeVisible();

  // Форма очищена — можно заводить следующий тип.
  await expect(form.getByLabel("Идентификатор")).toHaveValue("");

  // Главное: новый вид виден гостю и по нему считаются слоты.
  await page.goto("/");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(slotButtons(page).first()).toBeVisible();
});

test("В-2: идентификатор проверяется по правилам контракта", async ({ page }) => {
  await page.goto("/admin/event-types");

  const form = page.locator("form");
  await form.getByLabel("Название").fill("Тип с плохим идентификатором");

  await form.getByLabel("Идентификатор").fill("Bad Id!");
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(
    form.getByText("Только строчные латинские буквы, цифры и дефис между ними"),
  ).toBeVisible();

  // Формат исправлен, но такой идентификатор уже занят сид-данными:
  // ошибку возвращает бэкенд, и она показывается прямо на поле.
  await form.getByLabel("Идентификатор").fill("znakomstvo");
  await form.getByRole("button", { name: "Создать" }).click();
  await expect(
    form.getByText("Такой идентификатор уже занят — выберите другой"),
  ).toBeVisible();
});
