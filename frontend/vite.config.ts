import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Бэкенд (или мок Prism) поднимается на 3000 и отвечает по тем же путям,
// что объявлены в контракте, — переписывать префикс не нужно.
const apiProxy = {
  "/api/v1": {
    target: "http://localhost:3000",
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  // `vite preview` не наследует настройки `server`, а e2e гоняются именно
  // по собранной статике — прокси приходится задавать второй раз.
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
