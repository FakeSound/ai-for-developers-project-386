/**
 * Шаг 3 сценария гостя: выбор свободного слота внутри выбранного дня.
 *
 * Показываются только слоты, пришедшие от сервера: он уже исключил время,
 * занятое бронями любых типов событий.
 */

import type { Slot } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { formatPlainDate, formatSlotCount, formatTime } from "@/lib/datetime";

export function SlotPicker({
  date,
  slots,
  timeZone,
  onSelectSlot,
}: {
  date: string | null;
  slots: Slot[];
  timeZone: string;
  onSelectSlot: (slot: Slot) => void;
}) {
  if (!date) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>Выберите день</EmptyTitle>
          <EmptyDescription>
            Свободное время появится здесь после выбора даты в календаре.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-heading text-sm font-semibold first-letter:uppercase">
          {formatPlainDate(date, timeZone)}
        </h3>
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatSlotCount(slots.length)}
        </span>
      </div>

      {slots.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>В этот день свободного времени нет</EmptyTitle>
            <EmptyDescription>Выберите другую дату.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div
          className="grid max-h-[26rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3"
          role="group"
          aria-label={`Свободное время на ${formatPlainDate(date, timeZone)}`}
        >
          {slots.map((slot) => (
            <Button
              key={slot.startsAt}
              variant="outline"
              className="tabular-nums"
              onClick={() => onSelectSlot(slot)}
            >
              {formatTime(slot.startsAt, timeZone)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
