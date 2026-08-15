/**
 * Шаг 1 сценария гостя: страница с видами брони.
 *
 * Показывает название, описание и длительность каждого типа события.
 */

import { ArrowRight, Clock } from "lucide-react";
import { Link } from "react-router";

import { useEventTypes, useOwner } from "@/api/queries";
import { ErrorState } from "@/components/ErrorState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration, formatTimeZoneOffset } from "@/lib/datetime";

export function EventTypesPage() {
  const { data: owner } = useOwner();
  const { data: eventTypes, isPending, error, refetch } = useEventTypes();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        {owner ? (
          <p className="text-primary text-sm font-medium">{owner.name}</p>
        ) : (
          <Skeleton className="h-5 w-32" />
        )}
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
          Записаться на встречу
        </h1>
        <p className="text-muted-foreground max-w-2xl text-pretty">
          Выберите вид встречи, затем свободное время в ближайшие{" "}
          {owner?.bookingWindowDays ?? 14} дней. Регистрация не нужна —
          достаточно имени и почты.
          {owner ? (
            <>
              {" "}
              Время показано в поясе {owner.timeZone} (
              {formatTimeZoneOffset(owner.timeZone)}).
            </>
          ) : null}
        </p>
      </header>

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="mt-2 h-6 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : eventTypes.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>Пока нет ни одного вида встреч</EmptyTitle>
            <EmptyDescription>
              Владелец календаря ещё не создал типы событий.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              to="/admin/event-types"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Создать тип события
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eventTypes.map((eventType) => (
            <Card
              key={eventType.id}
              className="group hover:border-primary/40 relative transition-colors"
            >
              <CardHeader>
                <CardTitle className="text-lg">
                  <Link
                    to={`/event-types/${eventType.id}`}
                    className="after:absolute after:inset-0"
                  >
                    {eventType.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-muted-foreground text-sm text-pretty">
                  {eventType.description}
                </p>
                <div className="mt-auto flex items-center justify-between pt-1">
                  <Badge variant="secondary">
                    <Clock aria-hidden />
                    {formatDuration(eventType.durationMinutes)}
                  </Badge>
                  <ArrowRight
                    className="text-muted-foreground group-hover:text-primary size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
