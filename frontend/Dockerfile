# Фронтенд: собранная статика под nginx. Он же проксирует /api/v1 на бэкенд,
# поэтому браузер ходит на один origin и CORS не задействован.
#
# Компиляция TypeSpec здесь не нужна: и openapi/openapi.yaml, и
# src/api/schema.d.ts лежат в репозитории, так что сборка самодостаточна.

FROM node:22-alpine AS build

WORKDIR /app

# Зависимости отдельным слоем: пересобираются только при смене lock-файла.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
