/**
 * Шаг 2 сценария гостя: выбор дня в окне записи.
 *
 * Доступны только дни, в которых сервер вернул хотя бы один свободный слот.
 * Дни вне диапазона `SlotsPage.from`–`to` календарь не показывает вовсе.
 */

import { ru } from "date-fns/locale";
import { useMemo } from "react";

import type { SlotsPage } from "@/api/types";
import { Calendar } from "@/components/ui/calendar";
import { localDateToPlainDate, plainDateToLocalDate } from "@/lib/datetime";

export function SlotCalendar({
  page,
  selectedDate,
  onSelectDate,
}: {
  page: SlotsPage;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const availableDates = useMemo(
    () =>
      new Set(
        page.days.filter((day) => day.slots.length > 0).map((day) => day.date),
      ),
    [page.days],
  );

  const isUnavailable = (date: Date) =>
    !availableDates.has(localDateToPlainDate(date));

  return (
    <Calendar
      mode="single"
      locale={ru}
      weekStartsOn={1}
      showOutsideDays={false}
      selected={selectedDate ? plainDateToLocalDate(selectedDate) : undefined}
      onSelect={(date) => {
        if (date) onSelectDate(localDateToPlainDate(date));
      }}
      disabled={isUnavailable}
      startMonth={plainDateToLocalDate(page.from)}
      endMonth={plainDateToLocalDate(page.to)}
      defaultMonth={plainDateToLocalDate(selectedDate ?? page.from)}
      modifiers={{ available: (date) => !isUnavailable(date) }}
      modifiersClassNames={{
        available: "font-medium",
      }}
      className="w-full [--cell-size:--spacing(9)] p-0"
    />
  );
}
