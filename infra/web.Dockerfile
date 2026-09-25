FROM node:24.13.1-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
RUN npm run build -w apps/web

FROM caddy:2.10.2-alpine
COPY infra/Caddyfile.local /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
EXPOSE 9090
