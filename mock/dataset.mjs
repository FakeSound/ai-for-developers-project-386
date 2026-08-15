/**
 * Источник правды для мок-данных.
 *
 * Всё считается относительно момента запуска, поэтому окно записи всегда
 * начинается с сегодняшнего дня и примеры не протухают.
 *
 * Соответствие контракту (main.tsp):
 * - слоты строятся по сетке владельца от `workDayStart` с шагом `slotStepMinutes`;
 * - слот попадает в выдачу, только если целиком помещается до `workDayEnd`;
 * - слот исключается, если пересекается с бронью ЛЮБОГО типа события
 *   (правило глобальной занятости календаря);
 * - в `days` попадают и дни без свободных слотов — с пустым массивом.
 */

import { TZDate } from "@date-fns/tz";

const WEEKDAY_BY_INDEX = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// ---------------------------------------------------------------------------
// Владелец
// ---------------------------------------------------------------------------

export const owner = {
  id: "owner-1",
  name: "Анна Смирнова",
  email: "anna@aicalls.dev",
  timeZone: "Europe/Moscow",
  workdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  workDayStart: "10:00",
  workDayEnd: "18:00",
  slotStepMinutes: 30,
  bookingWindowDays: 14,
};

// ---------------------------------------------------------------------------
// Типы событий
// ---------------------------------------------------------------------------

/** Момент создания типов событий — фиксированный сдвиг в прошлое от «сейчас». */
const createdAt = (daysAgo) =>
  toUtcIso(new Date(Date.now() - daysAgo * 86_400_000));

export const eventTypes = [
  {
    id: "znakomstvo",
    title: "Знакомство",
    description:
      "Короткая встреча, чтобы познакомиться, обсудить вашу задачу и понять, чем я могу помочь. Без подготовки — просто расскажите, что у вас происходит.",
    durationMinutes: 30,
    createdAt: createdAt(45),
  },
  {
    id: "konsultaciya",
    title: "Консультация",
    description:
      "Разбираем вашу задачу предметно: архитектура, процессы, найм или что-то ещё из моей области. К встрече лучше прислать вводные заранее — так успеем больше.",
    durationMinutes: 60,
    createdAt: createdAt(30),
  },
  {
    id: "bystryj-zvonok",
    title: "Быстрый звонок",
    description:
      "Пятнадцать минут на один конкретный вопрос. Подходит, если нужно быстро свериться или получить короткий ответ, а полноценная встреча избыточна.",
    durationMinutes: 15,
    createdAt: createdAt(12),
  },
];

export const eventTypeById = Object.fromEntries(
  eventTypes.map((t) => [t.id, t]),
);

const summaryOf = (eventType) => ({
  id: eventType.id,
  title: eventType.title,
  durationMinutes: eventType.durationMinutes,
});

// ---------------------------------------------------------------------------
// Время: локальное время владельца <-> UTC
// ---------------------------------------------------------------------------

/** `Date` -> строка UTC ISO-8601 без миллисекунд: `2026-08-17T07:00:00Z`. */
function toUtcIso(date) {
  return new Date(date.getTime()).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** `"10:30"` -> `{ hours: 10, minutes: 30 }`. */
function parseTimeOfDay(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours, minutes };
}

/**
 * Настенное время в поясе владельца -> момент UTC.
 *
 * TZDate знает про переходы на летнее время, поэтому смещение берётся
 * для конкретной даты, а не фиксированное.
 */
function ownerWallTimeToUtc(day, minutesFromMidnight) {
  const hours = Math.floor(minutesFromMidnight / 60);
  const minutes = minutesFromMidnight % 60;
  return new TZDate(
    day.year,
    day.month - 1,
    day.day,
    hours,
    minutes,
    0,
    0,
    owner.timeZone,
  );
}

/** Сегодняшняя календарная дата в поясе владельца. */
function todayInOwnerTz() {
  const now = TZDate.tz(owner.timeZone);
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

/** Календарные дни окна записи: сегодня .. сегодня + bookingWindowDays включительно. */
function windowDays() {
  const today = todayInOwnerTz();
  const days = [];
  for (let offset = 0; offset <= owner.bookingWindowDays; offset += 1) {
    // Полдень, чтобы сдвиг на сутки не сломался о переход на летнее время.
    const d = new TZDate(
      today.year,
      today.month - 1,
      today.day + offset,
      12,
      0,
      0,
      0,
      owner.timeZone,
    );
    days.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
      weekday: WEEKDAY_BY_INDEX[d.getDay()],
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`,
    });
  }
  return days;
}

const isWorkday = (day) => owner.workdays.includes(day.weekday);

// ---------------------------------------------------------------------------
// Засеянные брони
// ---------------------------------------------------------------------------

/**
 * Брони расставляются по рабочим дням окна (индекс в списке рабочих дней),
 * а не по календарным — иначе они попадали бы на выходные.
 */
const BOOKING_SEEDS = [
  { workdayIndex: 0, time: "11:00", eventTypeId: "znakomstvo", guest: { name: "Игорь Ковалёв", email: "igor.kovalev@example.com" }, notes: "Хочу обсудить переход с монолита на сервисы." },
  { workdayIndex: 0, time: "15:00", eventTypeId: "konsultaciya", guest: { name: "Мария Титова", email: "m.titova@example.com" } },
  { workdayIndex: 1, time: "10:30", eventTypeId: "bystryj-zvonok", guest: { name: "Павел Дорохов", email: "pavel@example.com" }, notes: "Один вопрос по код-ревью." },
  { workdayIndex: 3, time: "14:00", eventTypeId: "konsultaciya", guest: { name: "Ольга Бирюкова", email: "olga.b@example.com" }, notes: "Нужен разбор процесса найма в команду из пяти человек." },
  { workdayIndex: 5, time: "12:00", eventTypeId: "znakomstvo", guest: { name: "艾 Чен", email: "ai.chen@example.com" } },
  { workdayIndex: 7, time: "16:30", eventTypeId: "znakomstvo", guest: { name: "Дмитрий Валеев", email: "d.valeev@example.com" } },
];

/** Занятые интервалы календаря (миллисекунды), общие для всех типов событий. */
function buildBookings() {
  const workdays = windowDays().filter(isWorkday);

  return BOOKING_SEEDS.flatMap((seed, index) => {
    const day = workdays[seed.workdayIndex];
    if (!day) return [];

    const eventType = eventTypeById[seed.eventTypeId];
    const { hours, minutes } = parseTimeOfDay(seed.time);
    const startsAt = ownerWallTimeToUtc(day, hours * 60 + minutes);
    const endsAt = new Date(
      startsAt.getTime() + eventType.durationMinutes * 60_000,
    );

    return [
      {
        id: `bkg-${String(index + 1).padStart(4, "0")}`,
        eventType: summaryOf(eventType),
        startsAt: toUtcIso(startsAt),
        endsAt: toUtcIso(endsAt),
        guest: seed.guest,
        ...(seed.notes ? { notes: seed.notes } : {}),
        createdAt: createdAt(index + 2),
      },
    ];
  }).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export const bookings = buildBookings();

const busyIntervals = bookings.map((b) => ({
  start: Date.parse(b.startsAt),
  end: Date.parse(b.endsAt),
}));

const overlapsBooking = (start, end) =>
  busyIntervals.some((busy) => start < busy.end && end > busy.start);

// ---------------------------------------------------------------------------
// Календарь свободных слотов
// ---------------------------------------------------------------------------

/**
 * `SlotsPage` для одного типа события на всё окно записи.
 *
 * Прошедшие слоты сегодняшнего дня отбрасываются: записаться на них нельзя.
 */
export function buildSlotsPage(eventTypeId) {
  const eventType = eventTypeById[eventTypeId];
  const duration = eventType.durationMinutes;
  const dayStart = parseTimeOfDay(owner.workDayStart);
  const dayEnd = parseTimeOfDay(owner.workDayEnd);
  const startMinutes = dayStart.hours * 60 + dayStart.minutes;
  const endMinutes = dayEnd.hours * 60 + dayEnd.minutes;
  const now = Date.now();

  const days = windowDays().map((day) => {
    if (!isWorkday(day)) return { date: day.date, slots: [] };

    const slots = [];
    for (
      let minute = startMinutes;
      minute + duration <= endMinutes;
      minute += owner.slotStepMinutes
    ) {
      const startsAt = ownerWallTimeToUtc(day, minute);
      const start = startsAt.getTime();
      const end = start + duration * 60_000;

      if (start <= now) continue;
      if (overlapsBooking(start, end)) continue;

      slots.push({ startsAt: toUtcIso(startsAt), endsAt: toUtcIso(new Date(end)) });
    }
    return { date: day.date, slots };
  });

  return {
    eventTypeId,
    durationMinutes: duration,
    timeZone: owner.timeZone,
    from: days[0].date,
    to: days[days.length - 1].date,
    days,
  };
}

/** Первый свободный слот — для примеров ответов на создание брони. */
export function firstFreeSlot(eventTypeId) {
  const page = buildSlotsPage(eventTypeId);
  for (const day of page.days) {
    if (day.slots.length > 0) return day.slots[0];
  }
  // Теоретически недостижимо: окно в 14 дней всегда содержит рабочие дни.
  throw new Error(`Нет свободных слотов для типа события ${eventTypeId}`);
}

export { toUtcIso };
