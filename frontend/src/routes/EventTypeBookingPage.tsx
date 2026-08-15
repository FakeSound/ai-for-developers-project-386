/**
 * Страница бронирования одного типа события.
 *
 * Собирает шаги 2–4 сценария гостя: календарь окна записи, свободные слоты
 * выбранного дня и форму брони.
 */

import { ArrowLeft, Clock, Globe } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { useEventType, useOwner, useSlots } from "@/api/queries";
import type { Booking, Slot } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { BookingDialog } from "@/components/booking/BookingDialog";
import { SlotCalendar } from "@/components/booking/SlotCalendar";
import { SlotPicker } from "@/components/booking/SlotPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatTimeZoneOffset } from "@/lib/datetime";

export function EventTypeBookingPage() {
  const { id = "" } = useParams();
  const { data: owner } = useOwner();
  const eventTypeQuery = useEventType(id);
  const slotsQuery = useSlots(id);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);

  const page = slotsQuery.data;
  const timeZone = page?.timeZone ?? owner?.timeZone ?? "UTC";

  /** Первый день окна, в котором вообще есть свободное время. */
  const firstAvailableDate = useMemo(
    () => page?.days.find((day) => day.slots.length > 0)?.date ?? null,
    [page],
  );

  // Открываем календарь сразу на ближайшем дне со свободным временем.
  useEffect(() => {
    setSelectedDate((current) => current ?? firstAvailableDate);
  }, [firstAvailableDate]);

  // Смена типа события — сбрасываем выбор.
  useEffect(() => {
    setSelectedDate(null);
    setSelectedSlot(null);
    setBooking(null);
  }, [id]);

  const slotsOfDay = useMemo(
    () => page?.days.find((day) => day.date === selectedDate)?.slots ?? [],
    [page, selectedDate],
  );

  const totalFreeSlots = useMemo(
    () => page?.days.reduce((sum, day) => sum + day.slots.length, 0) ?? 0,
    [page],
  );

  if (eventTypeQuery.error) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <ErrorState
          error={eventTypeQuery.error}
          title={
            eventTypeQuery.error.is("not_found")
              ? "Такого вида встреч нет"
              : "Не удалось загрузить вид встречи"
          }
          onRetry={() => eventTypeQuery.refetch()}
        />
      </div>
    );
  }

  const eventType = eventTypeQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <header className="flex flex-col gap-3">
        {eventType ? (
          <>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              {eventType.title}
            </h1>
            <p className="text-muted-foreground max-w-2xl text-pretty">
              {eventType.description}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <Clock aria-hidden />
                {formatDuration(eventType.durationMinutes)}
              </Badge>
              <Badge variant="outline">
                <Globe aria-hidden />
                {timeZone} · {formatTimeZoneOffset(timeZone)}
              </Badge>
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-6 w-32" />
          </>
        )}
      </header>

      {slotsQuery.error ? (
        <ErrorState
          error={slotsQuery.error}
          title="Не удалось загрузить свободное время"
          onRetry={() => slotsQuery.refetch()}
        />
      ) : slotsQuery.isPending ? (
        <Card>
          <CardContent className="grid gap-8 md:grid-cols-[auto_1fr]">
            <Skeleton className="h-72 w-full md:w-72" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 9 }, (_, index) => (
                <Skeleton key={index} className="h-9" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : totalFreeSlots === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Свободного времени нет</EmptyTitle>
            <EmptyDescription>
              В ближайшие {owner?.bookingWindowDays ?? 14} дней все слоты заняты.
              Загляните позже.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : page ? (
        <Card>
          <CardContent className="grid gap-6 md:grid-cols-[auto_auto_1fr]">
            <SlotCalendar
              page={page}
              selectedDate={selectedDate}
              onSelectDate={(date) => setSelectedDate(date)}
            />

            <Separator orientation="vertical" className="hidden md:block" />
            <Separator className="md:hidden" />

            <SlotPicker
              date={selectedDate}
              slots={slotsOfDay}
              timeZone={timeZone}
              onSelectSlot={setSelectedSlot}
            />
          </CardContent>
        </Card>
      ) : null}

      {eventType ? (
        <BookingDialog
          eventType={eventType}
          slot={selectedSlot}
          timeZone={timeZone}
          booking={booking}
          onBooked={(created) => {
            setSelectedSlot(null);
            setBooking(created);
          }}
          onClose={() => {
            setSelectedSlot(null);
            setBooking(null);
          }}
        />
      ) : null}
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
      <Link to="/">
        <ArrowLeft />К видам встреч
      </Link>
    </Button>
  );
}
