/**
 * Переключатель светлой и тёмной темы.
 *
 * Тема хранится в localStorage; при первом заходе берётся системная.
 * Начальный класс ставит инлайн-скрипт в index.html, чтобы страница
 * не мигала светлой темой до гидрации.
 */

import { Moon, Sun } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const STORAGE_KEY = "aicalls-theme";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={
        theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
      }
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
