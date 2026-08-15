/**
 * Форматирование дат и времени.
 *
 * Все моменты приходят из API в UTC, а показывать их нужно в часовом поясе
 * владельца календаря (`Owner.timeZone`) — иначе гость из другого пояса увидит
 * не то время, на которое записывается. Пояс всегда передаётся явно.
 */

const LOCALE = "ru-RU";

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let cached = formatterCache.get(key);
  if (!cached) {
    cached = new Intl.DateTimeFormat(LOCALE, { ...options, timeZone });
    formatterCache.set(key, cached);
  }
  return cached;
}

/** `2026-08-17T07:00:00Z` -> `10:00` в поясе владельца. */
export function formatTime(instant: string, timeZone: string) {
  return formatter(timeZone, { hour: "2-digit", minute: "2-digit" }).format(
    new Date(instant),
  );
}

/** `2026-08-17T07:00:00Z` + `2026-08-17T07:30:00Z` -> `10:00 – 10:30`. */
export function formatTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
) {
  return `${formatTime(startsAt, timeZone)} – ${formatTime(endsAt, timeZone)}`;
}

/** `2026-08-17` -> `понедельник, 17 августа`. */
export function formatPlainDate(date: string, timeZone: string) {
  return formatter(timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(plainDateToUtcNoon(date));
}

/** `2026-08-17T07:00:00Z` -> `17 августа 2026 г., 10:00`. */
export function formatDateTime(instant: string, timeZone: string) {
  return formatter(timeZone, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(instant));
}

/** Календарная дата момента в поясе владельца: `2026-08-17`. */
export function plainDateOf(instant: string, timeZone: string) {
  const parts = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * `plainDate` из контракта -> `Date` для react-day-picker.
 *
 * Календарь работает в локальном поясе браузера, поэтому дата берётся на
 * полдень: так она не съедет на соседние сутки ни при каком смещении.
 */
export function plainDateToLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/** Обратное преобразование: `Date` из календаря -> `plainDate`. */
export function localDateToPlainDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function plainDateToUtcNoon(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

// ---------------------------------------------------------------------------
// Склонения
// ---------------------------------------------------------------------------

const pluralRules = new Intl.PluralRules(LOCALE);

function plural(count: number, forms: { one: string; few: string; many: string }) {
  const rule = pluralRules.select(count);
  if (rule === "one") return forms.one;
  if (rule === "few") return forms.few;
  return forms.many;
}

/** `30` -> `30 минут`, `1` -> `1 минута`, `60` -> `1 час`. */
export function formatDuration(minutes: number) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} ${plural(hours, { one: "час", few: "часа", many: "часов" })}`;
  }
  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} ч ${rest} мин`;
  }
  return `${minutes} ${plural(minutes, { one: "минута", few: "минуты", many: "минут" })}`;
}

/** `3` -> `3 слота`. */
export function formatSlotCount(count: number) {
  return `${count} ${plural(count, { one: "слот", few: "слота", many: "слотов" })}`;
}

/** `2` -> `2 встречи`. */
export function formatMeetingCount(count: number) {
  return `${count} ${plural(count, { one: "встреча", few: "встречи", many: "встреч" })}`;
}

/** Смещение пояса владельца для подписи: `UTC+3`. */
export function formatTimeZoneOffset(timeZone: string) {
  const label = formatter(timeZone, { timeZoneName: "shortOffset" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value;
  return label ?? timeZone;
}
