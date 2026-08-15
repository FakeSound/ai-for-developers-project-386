/**
 * Страница предстоящих встреч владельца.
 *
 * Один список бронирований всех типов событий по возрастанию `startsAt`.
 * Карточка типа события приходит внутри брони, дозапросы не нужны.
 */

import { CalendarDays } from "lucide-react";
import { useMemo } from "react";

import { useAdminBookings, useOwner } from "@/api/queries";
import type { Booking } from "@/api/types";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDuration,
  formatMeetingCount,
  formatPlainDate,
  formatTimeRange,
  formatTimeZoneOffset,
  plainDateOf,
} from "@/lib/datetime";

export function AdminBookingsPage() {
  const { data: owner } = useOwner();
  const { data: bookings, isPending, error, refetch } = useAdminBookings();
  const timeZone = owner?.timeZone ?? "UTC";

  /** Группировка по календарным дням в поясе владельца. */
  const days = useMemo(() => {
    if (!bookings) return [];
    const byDate = new Map<string, Booking[]>();
    for (const booking of bookings) {
      const date = plainDateOf(booking.startsAt, timeZone);
      const list = byDate.get(date);
      if (list) list.push(booking);
      else byDate.set(date, [booking]);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, items }));
  }, [bookings, timeZone]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Предстоящие встречи
        </h1>
        <p className="text-muted-foreground">
          Все записи по всем типам событий.
          {bookings ? ` ${formatMeetingCount(bookings.length)}.` : ""} Время в
          поясе {timeZone} ({formatTimeZoneOffset(timeZone)}).
        </p>
      </header>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="flex flex-col gap-4">
          {[0, 1].map((index) => (
            <Card key={index}>
              <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>Записей пока нет</EmptyTitle>
            <EmptyDescription>
              Как только гость забронирует слот, встреча появится здесь.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {days.map((day) => (
            <section key={day.date} className="flex flex-col gap-3">
              <h2 className="text-muted-foreground text-sm font-medium first-letter:uppercase">
                {formatPlainDate(day.date, timeZone)}
              </h2>

              <Card className="overflow-hidden py-0">
                <ul className="divide-y">
                  {day.items.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5"
                    >
                      <div className="w-32 shrink-0 font-medium tabular-nums">
                        {formatTimeRange(
                          booking.startsAt,
                          booking.endsAt,
                          timeZone,
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {booking.guest.name}
                          </span>
                          <Badge variant="secondary">
                            {booking.eventType.title}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {formatDuration(booking.eventType.durationMinutes)}
                          </span>
                        </div>
                        <a
                          href={`mailto:${booking.guest.email}`}
                          className="text-muted-foreground hover:text-foreground w-fit truncate text-sm underline-offset-4 hover:underline"
                        >
                          {booking.guest.email}
                        </a>
                        {booking.notes ? (
                          <p className="text-muted-foreground mt-1 text-sm text-pretty">
                            {booking.notes}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
