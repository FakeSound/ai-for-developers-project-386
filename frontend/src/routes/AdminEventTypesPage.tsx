/**
 * Управление типами событий: список и создание.
 *
 * Идентификатор задаёт владелец, поэтому валидация повторяет ограничения
 * `EventTypeCreate` из контракта, а 409 `event_type_exists` показывается
 * прямо на поле `id`.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Clock, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCreateEventType, useEventTypes } from "@/api/queries";
import { ErrorState } from "@/components/ErrorState";
import { FormRow } from "@/components/FormRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/datetime";

/** Ограничения один в один из модели `EventTypeCreate`. */
const eventTypeSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Укажите идентификатор")
    .max(64, "Не длиннее 64 символов")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Только строчные латинские буквы, цифры и дефис между ними",
    ),
  title: z
    .string()
    .trim()
    .min(1, "Укажите название")
    .max(100, "Не длиннее 100 символов"),
  description: z.string().trim().max(1000, "Не длиннее 1000 символов"),
  durationMinutes: z.coerce
    .number<number>()
    .int("Только целое число минут")
    .min(5, "Минимум 5 минут")
    .max(480, "Максимум 480 минут"),
});

type EventTypeForm = z.input<typeof eventTypeSchema>;

export function AdminEventTypesPage() {
  const { data: eventTypes, isPending, error, refetch } = useEventTypes();

  const form = useForm<EventTypeForm, unknown, z.output<typeof eventTypeSchema>>(
    {
      resolver: zodResolver(eventTypeSchema),
      defaultValues: {
        id: "",
        title: "",
        description: "",
        durationMinutes: 30,
      },
    },
  );

  const createEventType = useCreateEventType({
    onSuccess: (created) => {
      toast.success("Тип события создан", { description: created.title });
      form.reset();
    },
    onError: (apiError) => {
      if (apiError.is("event_type_exists")) {
        form.setError("id", {
          message: "Такой идентификатор уже занят — выберите другой",
        });
        return;
      }
      toast.error("Не удалось создать тип события", {
        description: apiError.message,
      });
    },
  });

  const submit = form.handleSubmit((values) => {
    createEventType.mutate(values);
  });

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Типы событий
        </h1>
        <p className="text-muted-foreground">
          Виды встреч, которые видят гости на странице записи.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section className="flex flex-col gap-4">
          {error ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : isPending ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-24 w-full" />
              ))}
            </div>
          ) : eventTypes.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>Типов событий пока нет</EmptyTitle>
                <EmptyDescription>
                  Создайте первый — он сразу появится на странице записи.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            eventTypes.map((eventType) => (
              <Card key={eventType.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {eventType.title}
                    <Badge variant="secondary">
                      <Clock aria-hidden />
                      {formatDuration(eventType.durationMinutes)}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    {eventType.id}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm text-pretty">
                    {eventType.description}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <Card className="lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle>Новый тип события</CardTitle>
            <CardDescription>
              Идентификатор задаёте вы, изменить его потом нельзя.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              <FormRow
                label="Идентификатор"
                required
                error={form.formState.errors.id?.message}
                hint="Например, razbor-rezyume"
              >
                {(props) => (
                  <Input
                    {...props}
                    {...form.register("id")}
                    className="font-mono"
                    placeholder="razbor-rezyume"
                    autoComplete="off"
                    spellCheck={false}
                  />
                )}
              </FormRow>

              <FormRow
                label="Название"
                required
                error={form.formState.errors.title?.message}
              >
                {(props) => (
                  <Input
                    {...props}
                    {...form.register("title")}
                    placeholder="Разбор резюме"
                  />
                )}
              </FormRow>

              <FormRow
                label="Описание"
                error={form.formState.errors.description?.message}
                hint="Гость увидит его на странице с видами брони."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    {...form.register("description")}
                    rows={3}
                    placeholder="Что происходит на встрече…"
                  />
                )}
              </FormRow>

              <FormRow
                label="Длительность, минут"
                required
                error={form.formState.errors.durationMinutes?.message}
                hint="От 5 до 480 минут."
              >
                {(props) => (
                  <Input
                    {...props}
                    {...form.register("durationMinutes")}
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    inputMode="numeric"
                  />
                )}
              </FormRow>

              <Button
                type="submit"
                className="mt-1"
                disabled={createEventType.isPending}
              >
                {createEventType.isPending ? <Spinner /> : <Plus />}
                Создать
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
