# Taskio

Taskio is a personal task planning and collaboration app under development. The current implementation provides the local stack, database health endpoint, ordered migration runner, shared API error contracts, and isolated verification harness. Product accounts and tasks are planned for later tasks.

## Requirements

- Docker Engine 29 or newer with Docker Compose plugin 5 or newer (verified with Engine 29.8.1 and Compose 5.5.1)
- GNU Make
- For host builds and type checking: Node.js 24 and npm 11 or 12 (verified with Node.js 24.20.0 and npm 12.1.0)

The Compose stack pins PostgreSQL 17.7, Node.js 24.13.1, Caddy 2.10.2, and the Playwright 1.63.0 test image. The npm package lock pins the Fastify, React, Vite, TypeScript, TypeBox, Vitest, ESLint, Playwright, and `pg` dependency tree.

## Start locally

```sh
cp .env.example .env
make up
```

Open [http://localhost:9090](http://localhost:9090). The gateway serves the browser app and forwards `/api/v1/*` to the private API. `GET http://localhost:9090/api/v1/health` returns `{"status":"ok","database":"ready"}` when PostgreSQL is reachable. Only the gateway publishes a host port, bound to `127.0.0.1:9090`; the API and PostgreSQL ports stay inside Compose. The named PostgreSQL volume persists across `make down` and restart.

`.env` is ignored by Git. The sample credentials are for local development only:

- `POSTGRES_PASSWORD` authenticates the local administrative database role.
- `MIGRATOR_PASSWORD` authenticates `taskio_migrator`, which owns the schema and may apply migrations.
- `APP_DB_PASSWORD` authenticates `taskio_app`, which receives DML privileges but cannot alter the schema.
- `APP_ORIGIN` is the exact browser origin and defaults to `http://localhost:9090`.

Compose supplies the appropriate `DATABASE_URL` and `API_PORT` to each service. The API also accepts `NODE_ENV=development|production`; production mode requires an HTTPS `APP_ORIGIN`. Do not put production credentials in `.env.example` or commit them. `make up` waits for PostgreSQL, provisions the separate roles, applies migrations, and only then starts the API and gateway.

```sh
make logs                 # follow service logs
docker compose ps         # inspect services and health
sh tests/ops/T01.sh       # running-stack smoke test (temporarily restarts db)
docker compose config --quiet
make migrate              # apply pending migrations; safe to rerun
make down                 # stop containers, preserve PostgreSQL data
```

For frontend-only Vite development, install the Node dependencies and run:

```sh
npm ci
npm run dev --workspace apps/web
```

Vite serves the browser app at [http://localhost:9090](http://localhost:9090). Stop
the Compose stack first if it is already using that port. This mode serves only
the frontend; use `make up` for the API and database-backed health endpoint.

The primary verification commands use disposable Compose projects and dedicated databases. They do not reuse the development volume:

```sh
make test-task TASK=T02   # exact API and operations files registered for T02
make test-ops TASK=T02    # exact operations files registered for T02
make check                # typecheck, lint, current API/web tests, production build
```

Unknown task IDs and task types without registered files fail instead of silently running nothing. Browser tests will use `make e2e-task TASK=Txx` or `make e2e` once an owning task registers files in `tests/task-manifest.json`; the separate Playwright service is already configured.

For direct host development, install dependencies and run individual source checks:

```sh
npm ci
make typecheck
make lint
make build
```

Migration files live in `apps/api/migrations` and are applied in filename order. The runner records each filename and SHA-256 checksum in `schema_migrations`, serializes concurrent runners with an advisory transaction lock, and rejects duplicate versions, out-of-order additions, and changed or missing applied files. The baseline migration contains no product tables. Public deployment is deferred. The planned server topology and transport decision are described in [the development rules](docs/development.md).
