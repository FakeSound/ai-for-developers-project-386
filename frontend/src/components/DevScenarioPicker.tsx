/**
 * Переключатель сценариев ответа мока для создания брони.
 *
 * Показывается только в dev-сборке и только когда API — мок Prism.
 * Нужен, потому что stateless-мок никогда не отдаст конфликт слота сам.
 */

import { FlaskConical } from "lucide-react";

import { isMockMode } from "@/api/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BOOKING_SCENARIOS,
  setBookingScenario,
  useBookingScenario,
  type BookingScenario,
} from "@/lib/mock-scenario";

export function DevScenarioPicker() {
  const scenario = useBookingScenario();

  if (!import.meta.env.DEV || !isMockMode) return null;

  return (
    <div className="hidden items-center gap-2 md:flex">
      <FlaskConical
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden
      />
      <Select
        value={scenario}
        onValueChange={(value) => setBookingScenario(value as BookingScenario)}
      >
        <SelectTrigger
          size="sm"
          className="w-[190px]"
          aria-label="Сценарий ответа мока на создание брони"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BOOKING_SCENARIOS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
