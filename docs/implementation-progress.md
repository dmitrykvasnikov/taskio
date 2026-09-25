# Implementation progress

## T01 — Local stack and database readiness

Status: verified on 2026-09-25. Branch: `codex-add-local-stack`.

The local stack now serves a React mount at `http://localhost:9090` through Caddy, forwards `/api/v1/health` to a private Fastify API, and uses a private PostgreSQL 17.7 service with a named persistent volume. The API checks database connectivity on startup with bounded retries and on each health request. A database outage yields only `{"status":"unavailable"}` with HTTP 503; recovery restores 200. Pool errors during an outage do not terminate the API. Compose publishes only loopback port 9090. No product tables or migrations were added.

Contract decisions: Node.js 24, npm workspaces, Fastify 5.12.5, React 19.2.0, Vite 7.3.6, TypeScript 5.9.3, `pg` 8.16.3, PostgreSQL 17.7, and Caddy 2.10.2 are pinned in the lockfile or container definitions. `createApp({db,config,clock})` and `Clock.now()` are available for later injectable API tests. `loadConfig` validates origin, PostgreSQL URL, mode, and port, and rejects an HTTP origin in production mode. The public HTTP deployment decision remains deferred as stated in `docs/development.md`.

Evidence (repository root):

- `sh tests/ops/T01.sh` before implementation: exit 7, no listener on localhost:9090 (expected missing-stack failure).
- `npm ci --no-audit --no-fund --cache /tmp/taskio-npm-cache`: exit 0; final lockfile was also installed successfully during the Docker builds.
- `npm run typecheck`: exit 0 for API and web.
- `npm run build`: exit 0 for API and web; Vite 7.3.6 built the browser bundle.
- `npm audit --audit-level=high --cache /tmp/taskio-npm-cache`: exit 0, zero known vulnerabilities after updating Fastify and Vite.
- `docker compose config --quiet`: exit 0 with `.env` copied from `.env.example`.
- `make up`: exit 0; DB, API, and gateway reported healthy.
- `sh tests/ops/T01.sh`: exit 0; index and browser bundle loaded; health 200, private DB/API ports, outage 503 with a safe body, recovery 200, and a database row survived a DB restart.
- `node -e` config assertion: exit 0; production HTTP origin and an origin with a path were rejected.
- `make down`: exit 0; containers/network stopped without removing the named PostgreSQL volume.
- `git diff --check`: exit 0.

The smoke test initially found that an idle `pg` pool error terminated the API during a DB outage, yielding gateway 502. An idle pool error handler was added; the final smoke run passed. No remaining operator input is needed for local development beyond copying `.env.example` to `.env`. Public deployment inputs and authorization are deferred.

## T02 — Migrations, error contracts, and isolated verification

Status: verified on 2026-09-25. Branch: `codex-establish-migrations-harness`.

The API now provides a transaction wrapper, ordered PostgreSQL migration runner, common TypeBox ID/date/page/error contracts, and safe global JSON error handling with request IDs, 64 KiB bodies, JSON content-type enforcement, and redacted logs. Migrations record filename/checksum metadata, run under an advisory transaction lock, rollback failed SQL, reject duplicate versions, out-of-order additions, and changed or missing applied files, and report the current version. The baseline migration creates no product tables.

Compose provisions distinct `taskio_migrator` and `taskio_app` roles. The migrator owns the schema; the application role has default DML privileges and cannot create schema objects. `make up` performs database readiness, role provisioning, and migration before starting the API. The manifest dispatcher runs literal task files in disposable Compose projects whose database names are guarded with the `taskio_test` prefix. Vitest, ESLint, build checks, helpers for isolated databases/apps/clocks/barriers, and a separate Playwright service are configured. T01's smoke test is registered in the manifest.

Contract decisions: migration filenames use `NNNN_lowercase_name.sql`; applied files are immutable. `ApiError` is `{error:{code,message,fields?,details?,requestId}}`; validation, missing routes, body limits, unsupported content types, and internal failures use the shared envelope. Resource tasks will define the concrete discriminated `details` variants. `Db.transaction` supplies one `pg.PoolClient`, commits successful work, rolls back failures, and always releases the client.

Evidence (repository root):

- `sh tests/ops/T01.sh` before T02: exit 0 after `make up`; prerequisite stack, outage recovery, and persistence checks passed.
- `make test-task TASK=T02` before implementation: exit 2, no target existed (expected missing-harness failure).
- `make test-task TASK=T99`: exit 2 with `Unknown task ID: T99` (expected negative check).
- `make test-task TASK=T02`: exit 0; 8 API tests and the T02 operations test passed against isolated PostgreSQL, including empty/rerun/checksum/order/failure/concurrency migration behavior, transaction rollback, database guard, error envelopes, limits, and redaction.
- `make migrate` first run: exit 0; applied `0001_migration_baseline.sql` and reported it current.
- `make migrate` second run: exit 0; reported no pending migrations with the same current version.
- `make up`: exit 0; PostgreSQL became healthy, roles were provisioned, migration completed, and API/web became healthy in order.
- `sh tests/ops/T01.sh` after T02: exit 0; the existing local stack smoke behavior remained intact with the application DB role.
- `make test-task TASK=T01`: exit 0; the registered T01 smoke ran against its own disposable Compose project and volume, including database outage/recovery, without touching the development stack.
- `make check`: exit 0; contracts/API/web typechecks, ESLint, 8 API tests, and all production builds passed in an isolated tool/database stack.
- `git diff --check`: exit 0.

No product tables or browser journeys exist yet. The Playwright service and commands are configured; an E2E task without a manifest entry intentionally exits nonzero. Public deployment inputs and authorization remain deferred.
