import { CalendarClock } from "lucide-react";
import { NavLink, Outlet } from "react-router";

import { useOwner } from "@/api/queries";
import { DevScenarioPicker } from "@/components/DevScenarioPicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTimeZoneOffset } from "@/lib/datetime";
import { cn } from "@/lib/utils";

/** Разделы приложения. Авторизации нет: админка отличается только маршрутом. */
const NAV = [
  { to: "/", label: "Запись", end: true },
  { to: "/admin", label: "Встречи", end: true },
  { to: "/admin/event-types", label: "Типы событий", end: false },
];

export function AppLayout() {
  const { data: owner, isPending } = useOwner();

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-30 border-b backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <CalendarClock className="size-4.5" aria-hidden />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-sm font-semibold">AICalls</span>
              {isPending ? (
                <Skeleton className="mt-0.5 h-3 w-24" />
              ) : (
                <span className="text-muted-foreground text-xs">
                  {owner?.name}
                </span>
              )}
            </span>
          </NavLink>

          {/* На узких экранах навигация уезжает на отдельную строку. */}
          <nav className="bg-muted/60 order-last flex w-full items-center gap-0.5 rounded-lg p-0.5 sm:order-none sm:ml-2 sm:w-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex-1 rounded-md px-2 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors sm:flex-none sm:px-3",
                    isActive
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <DevScenarioPicker />
            {owner ? (
              <span className="text-muted-foreground hidden text-xs tabular-nums lg:inline">
                {owner.timeZone} · {formatTimeZoneOffset(owner.timeZone)}
              </span>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto w-full max-w-6xl px-4 py-5 text-xs sm:px-6">
          Данные отдаёт мок Prism, собранный из контракта{" "}
          <code className="bg-muted rounded px-1 py-0.5">main.tsp</code>
        </div>
      </footer>
    </div>
  );
}
