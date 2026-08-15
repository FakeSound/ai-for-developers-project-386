/**
 * Собирает мок-спеку для Prism: берёт сгенерированный из main.tsp OpenAPI
 * и добавляет в ответы примеры с датами, посчитанными от сегодняшнего дня.
 *
 * Сам контракт (main.tsp / openapi/openapi.yaml) не меняется — примеры живут
 * только в производном файле mock/openapi.mock.yaml.
 *
 * Prism в статическом режиме отдаёт ПЕРВЫЙ пример из `examples`, а конкретный
 * выбирается заголовком `Prefer: example=<имя>` (и `Prefer: code=<статус>`
 * для выбора кода ответа). Поэтому порядок ключей задаёт поведение по умолчанию.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

import {
  bookings,
  buildSlotsPage,
  eventTypes,
  eventTypeById,
  firstFreeSlot,
  owner,
  toUtcIso,
} from "./dataset.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = resolve(root, "openapi/openapi.yaml");
const TARGET = resolve(root, "mock/openapi.mock.yaml");

const spec = YAML.parse(readFileSync(SOURCE, "utf8"));

/** Оборачивает голые значения в форму OpenAPI `examples`. */
const examples = (entries) =>
  Object.fromEntries(
    Object.entries(entries).map(([name, value]) => [name, { value }]),
  );

/** Ставит примеры в `responses[code].content['application/json']`. */
function setExamples(path, method, code, entries) {
  const response = spec.paths?.[path]?.[method]?.responses?.[String(code)];
  if (!response) {
    throw new Error(`Нет ответа ${method.toUpperCase()} ${path} -> ${code}`);
  }
  const media = response.content?.["application/json"];
  if (!media) {
    throw new Error(
      `Нет тела application/json у ${method.toUpperCase()} ${path} -> ${code}`,
    );
  }
  delete media.example;
  media.examples = examples(entries);
}

const apiError = (code, message, details) => ({
  code,
  message,
  ...(details ? { details } : {}),
});

// ---------------------------------------------------------------------------
// GET /owner
// ---------------------------------------------------------------------------

setExamples("/owner", "get", 200, { owner });

// ---------------------------------------------------------------------------
// GET /event-types, POST /event-types
// ---------------------------------------------------------------------------

setExamples("/event-types", "get", 200, { eventTypes });

setExamples("/event-types", "post", 201, {
  created: {
    id: "razbor-rezyume",
    title: "Разбор резюме",
    description: "Смотрим резюме вместе и правим формулировки.",
    durationMinutes: 45,
    createdAt: toUtcIso(new Date()),
  },
});

setExamples("/event-types", "post", 400, {
  validation_failed: apiError(
    "validation_failed",
    "Не удалось создать тип события: проверьте заполненные поля.",
    {
      id: "Идентификатор может состоять только из строчных латинских букв, цифр и дефисов.",
      durationMinutes: "Длительность должна быть от 5 до 480 минут.",
    },
  ),
});

setExamples("/event-types", "post", 409, {
  event_type_exists: apiError(
    "event_type_exists",
    "Тип события с таким идентификатором уже существует.",
    { id: "znakomstvo" },
  ),
});

// ---------------------------------------------------------------------------
// GET /event-types/{id}
// ---------------------------------------------------------------------------

setExamples(
  "/event-types/{id}",
  "get",
  200,
  Object.fromEntries(eventTypes.map((t) => [t.id, t])),
);

setExamples("/event-types/{id}", "get", 404, {
  not_found: apiError("not_found", "Тип события не найден."),
});

// ---------------------------------------------------------------------------
// GET /event-types/{id}/slots
// ---------------------------------------------------------------------------

setExamples(
  "/event-types/{id}/slots",
  "get",
  200,
  Object.fromEntries(eventTypes.map((t) => [t.id, buildSlotsPage(t.id)])),
);

setExamples("/event-types/{id}/slots", "get", 400, {
  validation_failed: apiError(
    "validation_failed",
    `Диапазон дат должен целиком лежать в окне записи на ${owner.bookingWindowDays} дней от текущей даты.`,
    { from: "Дата раньше текущей.", to: "Дата выходит за окно записи." },
  ),
});

setExamples("/event-types/{id}/slots", "get", 404, {
  not_found: apiError("not_found", "Тип события не найден."),
});

// ---------------------------------------------------------------------------
// POST /bookings
// ---------------------------------------------------------------------------

const bookedSlot = firstFreeSlot("konsultaciya");

// По примеру на каждый тип события: клиент выбирает нужный через
// `Prefer: example=<eventTypeId>`, иначе ответ на бронь «Знакомства»
// приходил бы с карточкой другого типа.
setExamples(
  "/bookings",
  "post",
  201,
  Object.fromEntries(
    eventTypes.map((eventType, index) => {
      const slot = firstFreeSlot(eventType.id);
      return [
        eventType.id,
        {
          id: `bkg-010${index + 1}`,
          eventType: {
            id: eventType.id,
            title: eventType.title,
            durationMinutes: eventType.durationMinutes,
          },
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          guest: { name: "Гость", email: "guest@example.com" },
          notes: "Комментарий гостя к встрече.",
          createdAt: toUtcIso(new Date()),
        },
      ];
    }),
  ),
);

setExamples("/bookings", "post", 400, {
  validation_failed: apiError(
    "validation_failed",
    "Проверьте имя и email — они обязательны для записи.",
    { "guest.email": "Некорректный адрес электронной почты." },
  ),
});

setExamples("/bookings", "post", 404, {
  not_found: apiError("not_found", "Тип события не найден."),
});

// Порядок важен: slot_taken — самый частый конфликт, он же ответ по умолчанию.
setExamples("/bookings", "post", 409, {
  slot_taken: apiError(
    "slot_taken",
    "Это время уже занято другой встречей. Выберите другой слот.",
    { startsAt: bookedSlot.startsAt },
  ),
  slot_not_in_grid: apiError(
    "slot_not_in_grid",
    `Начало встречи должно совпадать с сеткой слотов владельца (шаг ${owner.slotStepMinutes} минут).`,
  ),
  slot_out_of_window: apiError(
    "slot_out_of_window",
    `Записаться можно только на ближайшие ${owner.bookingWindowDays} дней.`,
  ),
});

// ---------------------------------------------------------------------------
// GET /admin/bookings
// ---------------------------------------------------------------------------

setExamples("/admin/bookings", "get", 200, { bookings });

setExamples("/admin/bookings", "get", 400, {
  validation_failed: apiError(
    "validation_failed",
    "Границы выборки заданы некорректно: `from` должен быть раньше `to`.",
  ),
});

// ---------------------------------------------------------------------------
// Базовый путь
// ---------------------------------------------------------------------------

/**
 * Prism монтирует роуты в корень и игнорирует путь из `servers[0].url`,
 * поэтому базовый путь переносится прямо в ключи `paths`. Так мок отвечает
 * ровно по тем адресам, которые объявлены в контракте (`/api/v1/...`),
 * и настоящий бэкенд можно подставить без правок на клиенте.
 */
const basePath = new URL(spec.servers[0].url).pathname.replace(/\/$/, "");
if (basePath) {
  spec.paths = Object.fromEntries(
    Object.entries(spec.paths).map(([path, item]) => [
      `${basePath}${path}`,
      item,
    ]),
  );
}

// ---------------------------------------------------------------------------

writeFileSync(TARGET, YAML.stringify(spec, { lineWidth: 0 }), "utf8");

const slotCount = eventTypes.reduce(
  (total, t) =>
    total +
    buildSlotsPage(t.id).days.reduce((sum, d) => sum + d.slots.length, 0),
  0,
);

console.log(
  `mock: ${TARGET.replace(`${root}/`, "")} — ${eventTypes.length} типа событий, ` +
    `${bookings.length} броней, ${slotCount} свободных слотов в окне на ${owner.bookingWindowDays} дней`,
);
