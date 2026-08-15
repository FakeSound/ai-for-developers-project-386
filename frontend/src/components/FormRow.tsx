/**
 * Строка формы: подпись, поле, подсказка и текст ошибки.
 *
 * Заменяет обёртку `form` из shadcn — в выбранном стиле её нет, а связка
 * `label` + `aria-invalid` + `aria-describedby` нужна во всех формах одинаково.
 */

import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";

export function FormRow({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="text-muted-foreground font-normal" aria-hidden>
            *
          </span>
        ) : null}
      </Label>

      {children({
        id,
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })}

      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
