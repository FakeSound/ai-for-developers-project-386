/**
 * Шаг 4 сценария гостя: имя, почта, комментарий и создание брони.
 *
 * После 201 диалог переключается на подтверждение и показывает данные
 * из ответа сервера. При 409 `slot_taken` диалог закрывается: календарь
 * уже перезапрошен мутацией, гостю нужно выбрать другое время.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck, CircleAlert } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { isMockMode } from "@/api/client";
import { useCreateBooking } from "@/api/queries";
import type { Booking, EventType, Slot } from "@/api/types";
import { FormRow } from "@/components/FormRow";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTime,
  formatDuration,
  formatTimeRange,
} from "@/lib/datetime";

/** Ограничения повторяют модели `Guest` и `BookingCreate` из контракта. */
const guestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Укажите, как к вам обращаться")
    .max(100, "Не длиннее 100 символов"),
  email: z
    .email("Похоже на опечатку в адресе почты")
    .max(254, "Не длиннее 254 символов"),
  notes: z.string().max(500, "Не длиннее 500 символов").optional(),
});

type GuestForm = z.infer<typeof guestSchema>;

export function BookingDialog({
  eventType,
  slot,
  timeZone,
  booking,
  onBooked,
  onClose,
}: {
  eventType: EventType;
  slot: Slot | null;
  timeZone: string;
  booking: Booking | null;
  onBooked: (booking: Booking) => void;
  onClose: () => void;
}) {
  const form = useForm<GuestForm>({
    resolver: zodResolver(guestSchema),
    defaultValues: { name: "", email: "", notes: "" },
  });

  const createBooking = useCreateBooking({
    onSuccess: onBooked,
    onError: (error) => {
      if (error.is("slot_taken")) {
        toast.error("Это время уже заняли", {
          description: "Календарь обновлён — выберите другой свободный слот.",
        });
        onClose();
        return;
      }
      toast.error("Не удалось создать запись", { description: error.message });
    },
  });

  const open = slot !== null || booking !== null;

  // Форма и прошлая ошибка не должны переезжать на следующий слот.
  // Обе `reset` стабильны, поэтому эффект срабатывает только на смену `open`.
  const { reset: resetForm } = form;
  const { reset: resetMutation } = createBooking;
  useEffect(() => {
    if (!open) {
      resetForm();
      resetMutation();
    }
  }, [open, resetForm, resetMutation]);

  const submit = form.handleSubmit((values) => {
    if (!slot) return;
    createBooking.mutate({
      eventTypeId: eventType.id,
      startsAt: slot.startsAt,
      guest: { name: values.name.trim(), email: values.email.trim() },
      ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {booking ? (
          <BookingConfirmation booking={booking} timeZone={timeZone} />
        ) : slot ? (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Подтвердите запись</DialogTitle>
              <DialogDescription asChild>
                <div className="text-foreground mt-1 flex flex-col gap-0.5">
                  <span className="font-medium">{eventType.title}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDateTime(slot.startsAt, timeZone)} ·{" "}
                    {formatDuration(eventType.durationMinutes)}
                  </span>
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-5">
              <FormRow label="Имя" required error={form.formState.errors.name?.message}>
                {(props) => (
                  <Input
                    {...props}
                    {...form.register("name")}
                    autoComplete="name"
                    placeholder="Иван Петров"
                  />
                )}
              </FormRow>

              <FormRow
                label="Email"
                required
                error={form.formState.errors.email?.message}
                hint="Отправим подтверждение и ссылку на встречу."
              >
                {(props) => (
                  <Input
                    {...props}
                    {...form.register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="ivan@example.com"
                  />
                )}
              </FormRow>

              <FormRow
                label="Комментарий"
                error={form.formState.errors.notes?.message}
                hint="Необязательно. Расскажите, что хотите обсудить."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    {...form.register("notes")}
                    rows={3}
                    placeholder="Хочу обсудить…"
                  />
                )}
              </FormRow>

              {createBooking.error && !createBooking.error.is("slot_taken") ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Запись не создана</AlertTitle>
                  <AlertDescription>
                    {createBooking.error.message}
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Отмена
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createBooking.isPending}>
                {createBooking.isPending ? <Spinner /> : null}
                Записаться
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BookingConfirmation({
  booking,
  timeZone,
}: {
  booking: Booking;
  timeZone: string;
}) {
  return (
    <>
      <DialogHeader>
        <div className="bg-primary/10 text-primary mb-2 flex size-11 items-center justify-center rounded-full">
          <CalendarCheck className="size-5.5" aria-hidden />
        </div>
        <DialogTitle>Встреча забронирована</DialogTitle>
        <DialogDescription>
          Подтверждение отправлено на {booking.guest.email}.
        </DialogDescription>
      </DialogHeader>

      <dl className="bg-muted/50 my-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 rounded-lg border p-4 text-sm">
        <dt className="text-muted-foreground">Встреча</dt>
        <dd className="font-medium">{booking.eventType.title}</dd>

        <dt className="text-muted-foreground">Когда</dt>
        <dd className="font-medium tabular-nums">
          {formatDateTime(booking.startsAt, timeZone)}
          <span className="text-muted-foreground font-normal">
            {" · "}
            {formatTimeRange(booking.startsAt, booking.endsAt, timeZone)}
          </span>
        </dd>

        <dt className="text-muted-foreground">Гость</dt>
        <dd className="font-medium">{booking.guest.name}</dd>

        {booking.notes ? (
          <>
            <dt className="text-muted-foreground">Комментарий</dt>
            <dd className="text-pretty">{booking.notes}</dd>
          </>
        ) : null}

        <dt className="text-muted-foreground">Номер</dt>
        <dd className="font-mono text-xs">{booking.id}</dd>
      </dl>

      {isMockMode ? (
        <p className="text-muted-foreground border-t pt-4 text-xs text-pretty">
          Ответ пришёл от мока Prism — это заготовленный в контракте пример,
          поэтому имя, почта и комментарий отличаются от введённых. Состояния
          мок не хранит: слот останется в календаре, а встреча не появится
          в списке предстоящих.
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button>Готово</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
