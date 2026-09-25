# Taskio

Taskio is a personal task planning and collaboration app under development. The current implementation is the local stack and database health endpoint. Accounts, tasks, migrations, and the full check suite are planned for later tasks.

## Requirements

- Docker Engine 29 or newer with Docker Compose plugin 5 or newer (verified with Engine 29.8.1 and Compose 5.5.1)
- GNU Make
- For host builds and type checking: Node.js 24 and npm 11 or 12 (verified with Node.js 24.20.0 and npm 12.1.0)

The Compose stack pins PostgreSQL 17.7, Node.js 24.13.1, and Caddy 2.10.2 container images. The npm package lock pins the Fastify, React, Vite, TypeScript, and `pg` dependency tree.

## Start locally

```sh
cp .env.example .env
make up
```

Open [http://localhost:9090](http://localhost:9090). The gateway serves the browser app and forwards `/api/v1/*` to the private API. `GET http://localhost:9090/api/v1/health` returns `{"status":"ok","database":"ready"}` when PostgreSQL is reachable. Only the gateway publishes a host port, bound to `127.0.0.1:9090`; the API and PostgreSQL ports stay inside Compose. The named PostgreSQL volume persists across `make down` and restart.

`.env` is ignored by Git. `POSTGRES_PASSWORD` is the local database password; the sample value is for local development only. `APP_ORIGIN` must be the exact browser origin and defaults to `http://localhost:9090` in the sample. Compose sets `DATABASE_URL` and `API_PORT` for the API. The API also accepts `NODE_ENV=development|production`; production mode requires an HTTPS `APP_ORIGIN`. Do not put production credentials in `.env.example` or commit them.

```sh
make logs                 # follow service logs
docker compose ps         # inspect services and health
sh tests/ops/T01.sh       # running-stack smoke test (temporarily restarts db)
docker compose config --quiet
make down                 # stop containers, preserve PostgreSQL data
```

To install and check the current source on the host:

```sh
npm ci
make typecheck
make build
```

There are no application migrations or product tables yet. `make migrate`, `make check`, lint, API/web unit tests, and browser end-to-end tests will be introduced in later tasks; they are not working commands at this stage. Public deployment is deferred. The planned server topology and transport decision are described in [the development rules](docs/development.md).
