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
