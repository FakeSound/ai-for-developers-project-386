import { Route, Routes } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { AdminBookingsPage } from "@/routes/AdminBookingsPage";
import { AdminEventTypesPage } from "@/routes/AdminEventTypesPage";
import { EventTypeBookingPage } from "@/routes/EventTypeBookingPage";
import { EventTypesPage } from "@/routes/EventTypesPage";
import { NotFoundPage } from "@/routes/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Публичная часть: сценарий гостя */}
        <Route index element={<EventTypesPage />} />
        <Route path="event-types/:id" element={<EventTypeBookingPage />} />

        {/* Админская часть: работает от профиля владельца по умолчанию */}
        <Route path="admin" element={<AdminBookingsPage />} />
        <Route path="admin/event-types" element={<AdminEventTypesPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
