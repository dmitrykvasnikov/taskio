# Taskio Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` for one selected task per new session. Do not automatically start the next task after completing the selected one. The user requested separate sessions, not implementation in this planning session. Checkbox steps track execution; no task below is implemented yet.

**Goal:** Build the first Taskio release as small, independently verifiable sessions, beginning with the local stack and account access.

**Architecture:** React/TypeScript/Vite browser client, one Fastify/TypeScript JSON API, and PostgreSQL, orchestrated by Docker Compose. The browser uses one origin on port 9090; authorization and transactional domain rules live in the API. Production releases are transferred over SSH without Git remote access.

**Tech stack:** npm workspaces; TypeScript; React; Vite; Fastify with TypeBox JSON schemas; `pg` with parameterized SQL and ordered SQL migrations; Argon2id; Vitest; React Testing Library; Playwright; PostgreSQL; Docker Compose; Caddy. T01 selects mutually compatible supported versions and pins them in the lockfile and container definitions; this plan does not pretend dependencies are already installed.

**Spec:** [Agreed project brief](../../project-brief.md), including decisions D1–D10 and candidate slices S01–S27. [Planning request](../../../prompts/task-separation.md).

## Repository baseline and boundaries

Inspected on 2026-09-25 at local commit `e50fad0`. The repository contains `docs/project-brief.md` and `prompts/task-separation.md`; there is no application, package manifest, test runner, Compose stack, or migration history. No applicable `AGENTS.md` was present. The prompt has a pre-existing user edit; exclude it from planning commits.

All application paths below are proposed, not discovered existing interfaces. A task creates its listed files if they do not yet exist and modifies them otherwise. Use the same names in later sessions. Do not scaffold unselected tasks. If an earlier implementation changes a contract, update this plan and dependent task references in the same local commit.

## Global constraints

- “Git work and commits stay local; no Git remote operation is part of this project.” Do not fetch, pull, push, create a PR, or deploy by remote Git checkout.
- “The API is versioned under `/api/v1`.” The frontend never connects directly to PostgreSQL.
- Local browser origin is `http://localhost:9090`; production application binding is `127.0.0.1:9090`. Database and API container ports are private.
- Email: trim, syntactically valid, maximum 254 characters, unique case-insensitively. Nickname: 3–32 trimmed characters, unique case-insensitively. Internal user ID is immutable.
- Task description: 1–2,000 trimmed characters; comment/message body: 1–4,000; personal tag name: 1–40. All are plain text. Preserve task line breaks and escape all user content.
- Status values are `waiting`, `in_progress`, `done`; a new task starts `waiting`. Ownership never transfers; at most one pending/accepted assignment exists per task.
- Deadlines are calendar dates `YYYY-MM-DD`; overdue uses the viewer's local date and excludes done tasks.
- Task lists default to 20, maximum 100; comments use 20 per page oldest first by `(created_at, id)`; mail uses 20 per page newest first.
- Same-owner dependency links only. Cycle/status/access checks occur on the server inside transactions. Whole-graph access is an explicitly confirmed snapshot, never an automatic future grant.
- Every authenticated resource and nested payload enforces current access. Unavailable resources return indistinguishable 404 responses; no existence or content leaks through counts, cursors, graph nodes, replay responses, or notifications.
- Poll relevant open views every 30 seconds, refresh on focus, and provide manual refresh. No live push, read receipts, nested comments, email delivery/recovery, public sharing, groups, ownership transfer, attachments, account deletion/export, billing, or calendar integration.
- Each form needs labels, required-field indicators, keyboard access, visible focus, client/server errors, and pending/empty/error states. Browser acceptance includes phone and desktop sizes.
- Configuration uses environment/secrets; logs have request IDs and redact credentials, cookies, passwords, and user bodies. Never commit real secrets or production data.

## Production transport decision

**User decision, 2026-09-25: keep HTTP on public port 80 and defer public authenticated deployment.** Preserve D8: Caddy HTTP on 80 proxies to loopback 9090; do not add public HTTPS/443 in this release plan. T29/T30 package and privately rehearse that topology, but must not enable public account traffic or weaken production cookie protection. Use an explicitly isolated development-mode HTTP fixture for authenticated operations tests, and separately assert that production mode refuses an HTTP authentication origin. Public release remains deferred even if every local check passes. A later user-authorized transport decision is required to enable public accounts. This clarification supplements the unchanged brief and does not block implementation, backup tooling, or private acceptance.

## Review focus

1. Two valid requests racing must not break a graph or transition twice: real PostgreSQL two-connection tests in T13, T14, T17, T22.
2. A lost response followed by a retry must not duplicate a mutation or resurrect revoked content: T09, T19, T22, T24–T26 test replay after access changes.
3. A graph or status preview becoming stale while its dialog is open must require renewed confirmation without partial writes: T14 and T20.
4. Midnight, leap days, equal sort keys, and null deadlines must not shift dates or lose rows: T10/T11 use frozen clocks, timezones, and tied values.
5. Expiry or revocation during an open page must clear cached task content and prevent late responses restoring it: T05, T19, T23, T27/T28.

## Session protocol

Use this request in a new session, replacing the task ID:

> Read `docs/project-brief.md` and `docs/superpowers/plans/2026-09-25-taskio-implementation.md`. Implement only task **T01**, including its global contracts, tests, and documentation. Check prerequisite task evidence first. Make routine choices within the plan. Do not implement following tasks or use any Git remote. Preserve unrelated changes. Record verification evidence and make a scoped local commit.

Each task is one session-sized deliverable, not a promise that every task takes equal time. Dependencies mean prerequisite code and its tests pass, not just that its checkbox was checked. The suggested execution order is T01 through T32; the dependency table permits independent later branches of work without requiring parallel agents.

For every task:

1. Read the brief, common contracts below, that task, and prerequisite evidence. Inspect current Git state without a remote operation.
2. Write the named positive, invalid-input, and permission/regression tests; run the task command and observe the intended failure. For infrastructure, use a failing smoke assertion/config check instead of artificial unit tests.
3. Implement only the selected behavior and its UI, migration, and docs. Re-run targeted checks, then `make check` once it exists. Correct any failure before calling the task complete.
4. Update `docs/implementation-progress.md` with task ID, changed contract decisions, exact commands, results, and remaining operator inputs. Never record “passed” for a command not run. Commit only the task's files and progress entry locally; use `git add -- <explicit paths>` and the task's commit message. No automatic push.

## File ownership and shared interfaces

### Layout

| Path | Responsibility |
| --- | --- |
| `apps/api/src/app.ts`, `server.ts`, `config.ts` | Injectable Fastify app, process lifecycle, validated environment |
| `apps/api/src/db/` | Pool, transactions, migration runner, owner/pair locks |
| `apps/api/migrations/NNNN_name.sql` | Ordered immutable forward migrations; schema changes accompany behavior |
| `apps/api/src/modules/<resource>/` | Resource `routes.ts`, `service.ts`, `repository.ts`; no cross-module direct HTTP calls |
| `apps/api/src/security/` | Passwords, sessions, CSRF/origin checks, rate limits, request identity |
| `apps/api/src/shared/` | Error mapping, cursors, idempotency, transactional event writer |
| `packages/contracts/src/` | TypeBox request/response schemas and inferred TypeScript DTOs; no database or secrets |
| `apps/web/src/api/` | Typed same-origin fetch, CSRF, operation IDs, response handling |
| `apps/web/src/features/<resource>/` | Screens, resource client, forms, and resource UI components |
| `apps/web/src/components/`, `hooks/` | Shared accessible controls, polling, and session handling |
| `tests/api/Txx.test.ts` | Task-specific API/integration acceptance against real PostgreSQL |
| `tests/web/Txx.test.tsx` | Task-specific component behavior |
| `tests/e2e/Txx.spec.ts` | Task-specific real browser flow |
| `tests/ops/Txx.sh` | Infrastructure/package/deployment/restore acceptance |
| `tests/helpers/` | Isolated DBs, fixtures, authenticated agents, deterministic clock/barriers |
| `infra/`, `scripts/`, `docs/operations.md` | Containers, proxy, local checks, SSH deployment, backup/restore |

Every task also owns its evidence entry in `docs/implementation-progress.md`. Resource route registration is the only routine edit to `apps/api/src/app.ts`; frontend route registration belongs in `apps/web/src/App.tsx`. Update those when a task adds a route even if its file list focuses on resource-specific files.

### Common HTTP and types (T01–T09, extended by resource tasks)

- `Id` is a UUID string; `Instant` is an ISO UTC timestamp; `LocalDate` is a validated date string. DB timestamps are `timestamptz`, deadlines are `date`, and IDs are UUIDs generated by the server. Do not expose DB rows by spreading them into responses.
- `UserSelf = {id,email,nickname,createdAt,emailVerified:false}`; `UserSummary = {id,nickname}` is the public user summary. Exact buddy lookup may return that public summary but never the searched user's email.
- `ApiError = {error:{code,message,fields?:Record<string,string>,details?:ErrorDetails,requestId}}`. Map validation to 400, missing/expired authentication to 401, CSRF to 403, inaccessible/missing objects to the same 404, invalid transitions/duplicates/stale previews/key reuse to 409, body limit to 413, rate limit to 429 with `Retry-After`. `ErrorDetails` is a route-specific discriminated union: `{kind:"status_preview",preview:StatusPreview}`, `{kind:"access_preview",preview:AccessPreview}`, or `{kind:"blockers",tasks:TaskReference[]}`. `TaskReference` is `{restricted:false,task:TaskSummary}` or `{restricted:true}`; it never contains a hidden ID. Resource contract files define their own detail schemas; common errors do not import resource schemas. An accessible read-only task may return 403 for a forbidden operation; an invisible task must return 404.
- `Page<T> = {items:T[],nextCursor:string|null}`. Cursors are signed opaque encodings bound to requester, filters, sort, and last key; reject malformed/tampered/mismatched cursors with 400. Evaluate authorization anew for every page. Keyset ordering always includes ID. No total count that includes hidden rows.
- `TaskSummary = {id,description,status,deadline,owner:UserSummary,assignee:UserSummary|null,tags:Tag[],createdAt,updatedAt,version,permissions}`; `TaskDetail` uses these fields. `Tag = {id,name}`. `permissions = {edit:boolean,changeStatus:boolean,comment:boolean,manageAccess:boolean}`. Pending assignment is separately exposed to that recipient through assignment DTOs; permissions remain authoritative on the server.
- `createApp({db,config,clock}): Promise<FastifyInstance>` does not listen; tests use `app.inject`. `Clock.now(): Date`. `Db.transaction<T>(work:(tx:Tx)=>Promise<T>):Promise<T>` uses `Tx = pg.PoolClient` and provides one PostgreSQL client for all statements; services receive `Tx` rather than silently opening nested transactions.
- `requireUser(request): Promise<{userId:Id,sessionId:Id}>`; `getTaskAccess(tx,actorId,taskId): Promise<{task:TaskRow,rights:TaskRights}>` throws safe 404 if unreadable. `TaskRow` is private persistence data, defined in `modules/tasks/repository.ts`; `TaskRights` matches permissions above.
- Protected writes require an exact configured `Origin`, session cookie, and `X-CSRF-Token`. `GET /auth/csrf` creates/returns a signed, 30-minute CSRF context in an HttpOnly SameSite cookie before login; protected requests bind the token to the session after login. Signup/login also require origin and this token. JSON endpoints reject unsupported content types; cross-origin credential requests are not enabled.
- Production cookie: opaque 32-byte random session token, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no Domain; store its digest only, expire after 7 days without sliding extension. Local HTTP development explicitly omits Secure with environment validation. Login rotates the session and CSRF token; logout deletes it; password change revokes all sessions and asks for login again. Production rejects an HTTP public origin.
- Password planning default: 15–128 Unicode code points, no trimming or composition rules, Argon2id with per-password salt, memory at least 19 MiB, 2 iterations, parallelism 1; never log or serialize hash/plaintext. T03 benchmarks on its development container and records parameters. [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) supports the minimum hashing parameters.
- Use explicit field allowlists, 64 KiB request body limit, and Unicode code-point length checks. Normalize identity/tag comparison keys with trimming and Unicode normalization plus case folding in one shared helper; store unique normalized columns under deterministic DB collation. Passwords are never normalized. T03 freezes representative Unicode cases in tests so later writes cannot bypass uniqueness.
- Rate limits: login 5 attempts/minute per normalized identity and 30/minute per IP; signup 10/hour per IP; invitations 10/hour per sender; exact-user search 30/minute per actor. Use a PostgreSQL window-counter table with expiry cleanup, stable digests for identity keys, and atomic increments. Trust forwarded IP only from the configured proxy; never accept arbitrary client forwarding headers.
- `Idempotency-Key` is a client UUID for protected retryable mutations. T09 provides `runMutation<T>(tx, {actorId,key,route,requestHash}, authorize:()=>Promise<void>, work:()=>Promise<{status:number,body:T}>):Promise<{status:number,body:T}>`. Authorize current access before replay; reserve key and execute work/result insert in one transaction. Same actor/key with changed canonical route/body returns 409. Concurrent identical requests yield one committed result. Rollback leaves no completed reservation. Store minimal result references for task-bearing results and hydrate only after current authorization; no private task snapshot may be replayed after revocation/deletion. Retain keys for account lifetime in release 1; monitor size instead of expiring keys and allowing delayed duplicate sends.
- Frontend `apiRequest<T>(path,{method,body,operationId?,signal?}):Promise<T>` parses the error envelope, sends same-origin credentials and CSRF, reuses a key only for a retry of the same intent, and never auto-retries a rejected transition with a new key. Registration/login are separately protected by uniqueness and session rotation; all protected mutation forms adopt this client once T09 lands.

### Graph and transaction protocol (T13/T14/T20)

- Store each dependency once: `(prerequisite_task_id,dependent_task_id)`, with same-owner composite foreign keys and unique pair. Recursive queries deduplicate visited IDs. All graph/status/delete/access/assignment/comment writes for one owner's tasks take that owner's transaction lock **before** reading graph or access state. T07 establishes `withOwnerLock<T>(tx,ownerId,work):Promise<T>` using the owner's user row `SELECT ... FOR UPDATE`; T13 brings all existing relevant mutations under it. PostgreSQL holds row locks through the transaction; this plan deliberately serializes a small user's graph writes. [PostgreSQL locking documentation](https://www.postgresql.org/docs/17/explicit-locking.html) describes the locking behavior used here.
- Use READ COMMITTED; read the graph in a new statement after acquiring the lock. Discover a task owner, lock, then re-read existence/rights. A stale pre-lock read never authorizes a write. Invitation pair locks use canonical sorted user IDs, always in ascending order. Never acquire a pair lock after an owner lock; buddy checks during owner operations are read-only since removing a buddy is out of release scope.
- `previewStatus(tx,actorId,taskId,target):Promise<StatusPreview>` where `StatusPreview = {token,taskId,target,affected:VisibleTaskChange[],restrictedAffectedCount,expiresAt}`; include no hidden IDs or fields. A change item is `{id,description,from,to}`. The token binds actor, target, source version, and a digest of all relevant edges/statuses/versions, including hidden nodes. It expires in 10 minutes. Recompute under the lock on confirmation, reject stale token with 409 and return a fresh safe preview; never silently accept changed impact.
- `previewAccess(tx,ownerId,taskId,{recipientId,scope,kind}):Promise<AccessPreview>` where scope is `single|graph`, kind is `share|assignment`, and output is `{token,recipient:UserSummary,tasks:{id,description}[],expiresAt}`. Connected means reachability in either direction; assignment targets only the selected task. Bind the preview to membership, versions, scope, recipient, and kind. Confirmation recomputes the full set; a changed set or changed displayed description requires new confirmation.
- Status safety: progress requires every direct prerequisite done. On reopening, compute the least downstream reset closure: recursively reset progressed tasks with an unfinished direct prerequisite, propagating through already-waiting descendants as needed. Affected resets and source transition are one transaction. Adding an unfinished prerequisite to an already progressed task returns 409. Removing an edge never changes statuses. Before T14 enables reset previews, reject any reopen that would reset other tasks; never leave an invalid intermediate release.
- Graph output: `GraphPage = {nodes:VisibleGraphNode[],edges:GraphEdge[],truncated:boolean,nextCursor:string|null}`; `VisibleGraphNode` contains a permitted task summary. A `GraphEdge` is either between two visible IDs or `{visibleTaskId,direction,restricted:true}`. Do not expose hidden IDs, traversal tokens, statuses, owners, or counts of hidden graph interiors. Return visible reachable nodes, deduplicated by ID, plus generic boundary placeholders. T15 pages visible nodes in batches of 100; graph sharing independently enumerates the owner's complete component before confirmation.

### Events and access (T16 onwards)

- T16 introduces `emitEvent(tx,{type,actorId,recipientIds,subjectType,subjectId}):Promise<void>` and `notifications` storage in the same transaction as the action. Existing producers add calls as their tasks land; T24 later supplies the UI/read endpoints. No background broker is needed.
- Notification types: `invitation_received|invitation_accepted|invitation_declined|assignment_received|assignment_revoked|task_changed|task_reset|comment_added`. Notify relevant current participants other than actor; assignment revocation still sends a generic historical notice. A `NotificationDto` is `{id,type,createdAt,acknowledgedAt,summary,subject:{type,id}|null}`. Derive subject/details at read time with current access. Store generic event facts, never task descriptions/comment bodies in a historical summary. Deleted/inaccessible subjects become null.
- Effective task read = owner OR explicit `task_access` row OR assignment status pending/accepted. Explicit share is one `(task_id,user_id)` grant with `source=direct|graph` as provenance only. Graph access adds durable individual shares, independently reviewable and revocable; it does not create a live graph subscription. Single assignment decline/revocation removes its implicit access only. Extra graph-task shares survive until individually revoked; the confirmation UI explicitly explains this.
- Assignment terminal records persist; partial unique index permits only one pending/accepted per task. A pending owner replacement atomically cancels the old row and inserts a new request; replacing an accepted assignment requires explicit revoke first. Self-assignment/share is rejected.

### Verification command contract

These commands do **not** exist yet. T01/T02 create them and tests assert their behavior. All later task commands run from repository root. Every task with API/web/ops checks updates `tests/task-manifest.json`; tasks with browser files register them with the E2E dispatcher as well.

| Command | Required behavior / expected success |
| --- | --- |
| `make up` | Build/start local web gateway, API, database; ordered migration and health dependencies; browser at localhost:9090 |
| `make down` | Stop this Compose project without deleting its data volume |
| `make migrate` | Apply pending migrations once; fail atomically and stop on error |
| `make check` | Typecheck, lint, all current API/web tests, and production build; no skipped tests accepted |
| `make test-task TASK=Txx` | Run exactly the task's registered API/web/ops test files; nonzero for missing ID, missing test, or failing assertion |
| `make e2e-task TASK=Txx` | Start an isolated migrated test stack and run exactly `tests/e2e/Txx.spec.ts`; nonzero if missing |
| `make e2e` | All current browser journeys against an isolated real DB; clean up only that test project |
| `make test-ops TASK=Txx` | Run exactly `tests/ops/Txx.sh` with isolated volumes/fixtures and no production target |
| `make release-check` | T32 gate: check + e2e + production package/backup/deploy rehearsal checks; keep an evidence report |

T02 maintains `tests/task-manifest.json` mapping IDs to literal file paths, read by `scripts/test-task.mjs`; every subsequent task adds its own entry. T01 initially owns `tests/ops/T01.sh` and a simple bootstrap target, which T02 incorporates into the dispatcher. Run commands inside locked tool containers so Docker/Compose/Make are the host prerequisites. Never point tests at development or production DBs. T02 uses a disposable Compose project and dedicated DB, recreates the schema/migrations per suite, and runs concurrency tests with independent clients, not mocked repositories or timing sleeps. T03 adds `fixtures.user`; T05 adds `fixtures.signedInUser`; subsequent resources extend `tests/helpers/fixtures.ts` only as needed.

## Order, dependencies, and slice coverage

| Task | Deliverable | Prerequisites | Brief slices |
| --- | --- | --- | --- |
| T01 | Local stack and health | none | S01 |
| T02 | Migrations, contracts, test harness | T01 | S01, S27 foundation |
| T03 | Registration API and credentials | T02 | S02 |
| T04 | Registration page | T03 | S02 |
| T05 | Login, session, logout | T04 | S03 |
| T06 | Profile nickname/password | T05 | S04 |
| T07 | Create/list personal tasks | T05 | S05 |
| T08 | Task detail/edit/delete/status | T07 | S06 |
| T09 | Retry-safe mutation infrastructure | T08, T06 | cross-cutting |
| T10 | Task filters and cursor pagination | T09 | S07 |
| T11 | Date-only deadlines | T10 | S08 |
| T12 | Personal tags | T11 | S09 |
| T13 | Dependency edges and safe status gate | T12 | S10, S11 |
| T14 | Status impact preview and atomic reopen | T13 | S12 |
| T15 | Readable dependency view | T14 | S13 |
| T16 | Exact-user search and invitations/events | T15 | S14, S20 foundation |
| T17 | Invitation transitions and buddy list | T16 | S15 |
| T18 | Single-task share preview/grant | T15, T17 | S16 |
| T19 | Grant review/revoke and access regression | T18 | S16 |
| T20 | Whole-graph sharing | T19 | S17 |
| T21 | Assignment preview/request | T20 | S18 |
| T22 | Assignment accept/decline | T21 | S18 |
| T23 | Assignment cancel/replace/revoke | T22 | S19 |
| T24 | Notification list/acknowledge | T23 | S20 |
| T25 | Private inbox/outbox messages | T17, T24 | S21 |
| T26 | Flat task comments | T23, T24 | S22 |
| T27 | Focus/poll/manual refresh | T25, T26 | S23 |
| T28 | Browser accessibility/privacy journeys | T27, T06 | S27 product gates |
| T29 | Production package and proxy (private rehearsal) | T28 | S24 |
| T30 | Debian bootstrap and SSH deployment | T29 | S25 |
| T31 | Backup scheduling and restore drill | T26, T29 | S26 |
| T32 | Clean-checkout release rehearsal | T30, T31 | S27 |

The table is authoritative for IDs; task headings below carry detailed scope. T16 follows T15 so the numbered migration sequence stays monotonic; do not apply a higher-numbered migration before its earlier planned migrations exist. T01–T06 are the initial account tranche. T07–T12 yield personal planning. T13–T15 yield dependency management. T16–T23 yield collaboration. T24–T28 yield communication and product acceptance. T29–T32 yield operations acceptance.

## Detailed session tasks

### T01 — Start the local stack and show database readiness

**Files:** `package.json`, `package-lock.json`, `tsconfig.base.json`, `.gitignore`, `.dockerignore`, `.env.example`, `Makefile`, `compose.yaml`, `infra/api.Dockerfile`, `infra/web.Dockerfile`, `infra/Caddyfile.local`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/config.ts`, `apps/api/src/db/pool.ts`, `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `README.md`, `tests/ops/T01.sh`.

**Consumes/produces:** No code prerequisites. Produce `createApp`, `Clock`, config validation, and `GET /api/v1/health -> {status:'ok',database:'ready'}` (200), safe `{status:'unavailable'}` (503) on DB failure. A private API listens inside Compose; a gateway exposes 9090 and routes API/web on one origin.

**Migration/permissions:** No product tables. PostgreSQL named volume; DB/API ports not published. Health reveals no credentials, DSN, or internal errors.

- [ ] Add smoke checks for index HTML, browser mount, health JSON, non-public DB/API ports, unhealthy DB response, and data volume preservation after restart; run `sh tests/ops/T01.sh` to see the missing-stack failure.
- [ ] Pin compatible dependencies/images, create minimal app/server/frontend and validated env config, add readiness/backoff and graceful pool shutdown. Make `make up` the one-command local bootstrap and `.env.example` usable for local development without real credentials.
- [ ] Document prerequisites, copying local env, port usage, logs, and safe stop; run `make up`, `sh tests/ops/T01.sh`, `docker compose config --quiet`, and `make down`. Expected: successful page/readiness, controlled 503 while DB unavailable, persistent volume intact, exit 0 for config/smoke.
- [ ] Record evidence and commit `chore: add local Taskio stack and health checks`.

### T02 — Establish migrations, error contracts, and isolated test commands

**Files:** `apps/api/src/db/transaction.ts`, `apps/api/src/db/migrate.ts`, `apps/api/migrations/0001_migration_baseline.sql`, `infra/postgres/init-roles.sh`, `apps/api/src/shared/errors.ts`, `packages/contracts/package.json`, `packages/contracts/tsconfig.json`, `packages/contracts/src/common.ts`, `packages/contracts/src/index.ts`, `vitest.config.ts`, `eslint.config.js`, `playwright.config.ts`, `compose.test.yaml`, `scripts/test-task.mjs`, `scripts/check.mjs`, `tests/task-manifest.json`, `tests/helpers/database.ts`, `tests/helpers/app.ts`, `tests/helpers/clock.ts`, `tests/helpers/barrier.ts`, `tests/api/T02.test.ts`, `tests/ops/T02.sh`, `Makefile`, `README.md`.

**Consumes/produces:** T01 app factory/pool. Produce common ID/error/page schemas, `Db.transaction`, task dispatcher, typecheck/lint/build/test commands, and independent test connections. Migration runner takes `DATABASE_URL`, tracks filename/checksum in `schema_migrations`, serializes runners with a PostgreSQL advisory transaction lock, and reports the applied version.

**Migration/permissions:** Baseline only records migration metadata. Test DSN guard refuses any DB not marked for tests. Migration DB role may alter schema; application role may perform DML but cannot migrate.

- [ ] Cover empty DB migration, rerun no-op, checksum mismatch, failure rollback, concurrent runners, schema-invalid requests, consistent 400/404/500 envelope, log redaction, and unknown task ID failure. Run `make test-task TASK=T02` and observe missing behavior.
- [ ] Add transaction/migration runner and explicit test manifest. Add TypeBox validation, global body/content-type limits, request IDs and safe error logger. Provide tool containers and separate Playwright service; migrations finish before API readiness on `make up`.
- [ ] Run `make test-task TASK=T02`, `make migrate` twice, and `make check`. Expected: one application per migration, actual separate migration/application DB roles provisioned by the Compose initialization script `infra/postgres/init-roles.sh`, no leaked connections or secrets, intentional failed test migrations isolated, all checks exit 0. Register T01 smoke with the dispatcher.
- [ ] Commit `chore: add database migrations and verification harness`.

### T03 — Register accounts through the API

**Files:** `apps/api/migrations/0002_accounts.sql`, `packages/contracts/src/auth.ts`, `apps/api/src/modules/auth/routes.ts`, `apps/api/src/modules/auth/service.ts`, `apps/api/src/modules/auth/repository.ts`, `apps/api/src/security/passwords.ts`, `apps/api/src/security/identity.ts`, `apps/api/src/security/rate-limit.ts`, `apps/api/src/security/csrf.ts`, `tests/helpers/fixtures.ts`, `tests/api/T03.test.ts`.

**Consumes/produces:** T02 validation/transactions. `POST /auth/register {email,nickname,password} -> 201 UserSelf` does not log in; `GET /auth/csrf -> {token}`; `hashPassword(password):Promise<string>`, `verifyPassword(hash,password):Promise<boolean>`, `normalizeIdentity(value):string`. All paths are under `/api/v1`.

**Migration/permissions:** `users(id,email,email_key UNIQUE,nickname,nickname_key UNIQUE,password_hash,created_at)`; `rate_limit_windows(bucket,key_digest,window_start,count)` unique bucket/key/window. Registration is public but origin/CSRF/rate limited. User password/email keys never enter response serialization.

- [ ] Test accepted trimmed/case-normalized identity, email length/form, nickname 2/3/32/33 boundaries, Unicode equivalents, password 14/15/128/129 boundaries and preserved whitespace; concurrent duplicate signup yields one user and safe field conflict; salts differ for equal passwords. Test missing CSRF/wrong origin, oversize body, rate limits, and no credential fields/logging. Run `make test-task TASK=T03` red.
- [ ] Implement schemas, canonicalization, unique constraints, hash helper, CSRF bootstrap, transactional counters with expired-window cleanup, and generic server failures. Use a dummy hash path later for nonexistent-user login. Benchmark and document chosen hash parameters in `README.md`.
- [ ] Run `make test-task TASK=T03` and `make check`; expected one user per normalized identity, hash verifies, no plaintext persistence. Extend test fixtures with user creation through the supported service.
- [ ] Commit `feat: add validated account registration`.

### T04 — Deliver the registration browser flow

**Files:** `apps/web/src/api/client.ts`, `apps/web/src/features/auth/RegisterPage.tsx`, `apps/web/src/features/auth/client.ts`, `apps/web/src/components/FormField.tsx`, `apps/web/src/components/Notice.tsx`, `apps/web/src/styles.css`, `tests/web/T04.test.tsx`, `tests/e2e/T04.spec.ts`.

**Consumes/produces:** T03 register/CSRF and error DTOs. `/register` form submits once and shows a completed-registration state with a sign-in link (activated by T05). Establish typed API errors and same-origin CSRF client; operation-ID support arrives in T09.

**Migration/permissions:** None. Account form does not display another user's profile or persist passwords in browser storage.

- [ ] Test semantic labels, keyboard submit, field validation, password visibility without logging, duplicate server error, disabled submit while pending, and unverified-email/no-recovery notice. Run `make test-task TASK=T04` red.
- [ ] Add registration screen, field errors and retryable network error presentation; keep entered safe identity fields after error, clear password after success. Use readable focus/contrast and responsive single-column layout.
- [ ] Run `make test-task TASK=T04`, `make e2e-task TASK=T04`, `make check`. Expected: a browser registers and refresh does not resubmit; 390px and 1280px layouts have no clipped fields or horizontal scrolling.
- [ ] Commit `feat: add accessible registration flow`.

### T05 — Sign in, restore sessions, expire, and sign out

**Files:** `apps/api/migrations/0003_sessions.sql`, `apps/api/src/security/sessions.ts`, `apps/api/src/security/require-user.ts`, `apps/api/src/security/csrf.ts`, `apps/api/src/modules/auth/routes.ts`, `apps/api/src/modules/auth/service.ts`, `packages/contracts/src/auth.ts`, `apps/web/src/features/auth/LoginPage.tsx`, `apps/web/src/features/auth/SessionProvider.tsx`, `apps/web/src/features/auth/RequireSession.tsx`, `apps/web/src/api/client.ts`, `tests/helpers/auth.ts`, `tests/api/T05.test.ts`, `tests/web/T05.test.tsx`, `tests/e2e/T05.spec.ts`.

**Consumes/produces:** T03 password/rate-limit helpers. `POST /auth/login {email,password} -> UserSelf` sets rotated cookie; `GET /auth/me -> UserSelf`; `POST /auth/logout -> 204`; produce `requireUser`, session-aware CSRF and authenticated test agent.

**Migration/permissions:** `sessions(id,user_id,token_digest UNIQUE,csrf_digest,created_at,expires_at)` with user FK and expiry index. Logout/revocation deletes server state, not just a cookie. Cookie flags vary only by explicit local-vs-production config.

- [ ] Test correct/incorrect/nonexistent email login with identical invalid-credentials responses; pre-login token replacement, reload, seven-day expiry with fake clock, logout replay, forged cookie, CSRF/origin failures, limits, proxy-header spoofing, and production cookie flags. Run `make test-task TASK=T05` red.
- [ ] Implement session storage and identity middleware; add `/login`, current-user loading, protected routing, sign-out and 401 handling. Clear session-bound caches and abort requests on sign-out/expiry; do not redirect to untrusted return URLs.
- [ ] Run `make test-task TASK=T05`, `make e2e-task TASK=T05`, `make check`. Expected: reload retains login; expiry/logout blocks old cookie; two browser contexts remain isolated; unknown and incorrect passwords use the same outward error.
- [ ] Commit `feat: add cookie sessions and account login`.

### T06 — Update the current profile and password

**Files:** `packages/contracts/src/profile.ts`, `apps/api/src/modules/profile/routes.ts`, `apps/api/src/modules/profile/service.ts`, `apps/api/src/modules/profile/repository.ts`, `apps/web/src/features/profile/ProfilePage.tsx`, `apps/web/src/features/profile/client.ts`, `tests/api/T06.test.ts`, `tests/web/T06.test.tsx`, `tests/e2e/T06.spec.ts`.

**Consumes/produces:** T05 identity/session. `GET /profile -> UserSelf`; `PATCH /profile {nickname} -> UserSelf`; `POST /profile/password {currentPassword,newPassword} -> 204` revokes all sessions atomically with credential change. No target user ID or mutable email accepted.

**Migration/permissions:** None; existing unique nickname and sessions. Updates are self-only; current password required for password changes.

- [ ] Test nickname trim/limits/case uniqueness, unknown fields/email/userId rejection, anonymous 401, incorrect current password leaves sessions intact, successful change invalidates all sessions, old password fails/new works, concurrent nickname conflict. Run `make test-task TASK=T06` red.
- [ ] Add profile form, immutable/unverified email display, recovery limitation copy and password change success leading to sign-in. Reuse canonicalization and secure error handling.
- [ ] Run `make test-task TASK=T06`, `make e2e-task TASK=T06`, `make check`; verify a second user's nickname/password/session is unaffected.
- [ ] Commit `feat: add current-user profile settings`.

### T07 — Create and list personal waiting tasks

**Files:** `apps/api/migrations/0004_tasks.sql`, `packages/contracts/src/tasks.ts`, `apps/api/src/db/owner-lock.ts`, `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/api/src/modules/tasks/access.ts`, `apps/api/src/shared/cursor.ts`, `apps/web/src/features/tasks/TaskListPage.tsx`, `apps/web/src/features/tasks/CreateTaskForm.tsx`, `apps/web/src/features/tasks/client.ts`, `tests/api/T07.test.ts`, `tests/web/T07.test.tsx`, `tests/e2e/T07.spec.ts`.

**Consumes/produces:** T05 actor, T02 Page/error types. `POST /tasks {description} -> 201 TaskDetail`; `GET /tasks?cursor&limit -> Page<TaskSummary>` defaults to owned tasks, newest updated first. Produce `TaskRow`, `getTaskAccess`, and `withOwnerLock`; current rights are owner-only. `TaskSummary` contains deadline null, empty tags and assignee null until their tasks land.

**Migration/permissions:** `tasks(id,owner_id,description,status DEFAULT waiting,deadline DATE NULL,version DEFAULT 1,created_at,updated_at)` plus `(owner_id,id)` unique and list indexes. Status CHECK and description limits; API strips/rejects supplied owner/id/status. DB schema may include deadline now but T11 enables its write UI/API.

- [ ] Test task description boundaries/whitespace/line breaks, owner forgery, anonymous 401, unrelated list empty, more than 20 rows with tied timestamps and cursor continuity, 101 limit rejection. Run `make test-task TASK=T07` red.
- [ ] Add owner-scoped create/list and signed cursor utility, form/list states, and plain text rendering. Use default new-task status waiting and server timestamps.
- [ ] Run `make test-task TASK=T07`, `make e2e-task TASK=T07`, `make check`; two users create tasks and see only their own after reload. Include a literal HTML/script string rendered harmlessly.
- [ ] Commit `feat: create and list personal tasks`.

### T08 — View, edit, delete, and change personal task status

**Files:** `packages/contracts/src/tasks.ts`, `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/web/src/features/tasks/TaskDetailPage.tsx`, `apps/web/src/features/tasks/TaskEditor.tsx`, `apps/web/src/components/ConfirmDialog.tsx`, `tests/api/T08.test.ts`, `tests/web/T08.test.tsx`, `tests/e2e/T08.spec.ts`.

**Consumes/produces:** T07 access/lock. `GET /tasks/:id -> TaskDetail`; `PATCH /tasks/:id {description,version} -> TaskDetail`; `DELETE /tasks/:id {version} -> 204`; `POST /tasks/:id/status {status,version,previewToken?} -> TaskDetail`. T14 activates previewToken. Increment task version on writes; stale edit/delete/status returns 409.

**Migration/permissions:** None. Owner-only mutations under owner lock. Later child-table tasks must add cascade rules and extend this task's deletion regression.

- [ ] Test read/edit/delete/status reload, all three status values, description/status validation, stale editor 409, inaccessible UUID equal to missing UUID response, anonymous 401, and cancel/delete confirmation keyboard behavior. Run `make test-task TASK=T08` red.
- [ ] Add detail/editor/status controls and deletion confirmation; only apply client state after confirmed server result. Detail deletion returns to list. Define service hook for dependency eligibility to be added in T13 without duplicating status writes.
- [ ] Run `make test-task TASK=T08`, `make e2e-task TASK=T08`, `make check`; a third user cannot read or mutate by guessed task ID, and cancellation leaves the task untouched.
- [ ] Commit `feat: manage personal task details and status`.

### T09 — Persist mutation results for safe network retries

**Files:** `apps/api/migrations/0005_operation_results.sql`, `apps/api/src/shared/idempotency.ts`, `apps/web/src/api/operation.ts`, `apps/web/src/api/client.ts`, `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/modules/profile/routes.ts`, `tests/api/T09.test.ts`, `tests/web/T09.test.tsx`.

**Consumes/produces:** Common `runMutation` contract and owner-lock protocol. Require `Idempotency-Key` on protected domain mutations from this task onward, including existing task/profile mutations. Logout remains naturally idempotent and password change/session revocation replay returns 401 once the old session is invalid; it cannot bypass authentication.

**Migration/permissions:** `operation_results(actor_id,operation_key,route,request_hash,http_status,result_kind,result_ref,result_json,created_at)` unique actor/key. Store safe IDs/minimal results, never passwords/hashes or user bodies; operation hashes use server-keyed hashing for sensitive payloads. Authentication and current resource rights run before returning cached success.

- [ ] Test simultaneous identical creates yield one row/result, same key with changed route/body 409, separate actors isolate keys, aborted transaction retry succeeds once, malformed/missing keys 400, and deleted task cannot replay its former description. Test client retries keep key/body and a new intent uses a new key. Run `make test-task TASK=T09` red.
- [ ] Implement transactional reservation/result replay and reference-based hydration; adopt it in existing protected domain clients/routes. Establish ordering: identity, lock/resource authorization, reservation, write/event, result, commit. Concurrent reservations wait for the winning transaction rather than execute work twice.
- [ ] Run `make test-task TASK=T09` and `make check`; use two independent DB clients and response-loss simulation, not double-click-only UI tests.
- [ ] Commit `feat: make domain mutations safe to retry`.

### T10 — Filter and paginate personal task lists

**Files:** `packages/contracts/src/tasks.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/api/src/modules/tasks/routes.ts`, `apps/api/src/shared/cursor.ts`, `apps/web/src/features/tasks/TaskFilters.tsx`, `apps/web/src/features/tasks/TaskListPage.tsx`, `tests/api/T10.test.ts`, `tests/web/T10.test.tsx`, `tests/e2e/T10.spec.ts`.

**Consumes/produces:** `GET /tasks?view=owned|assigned|pending|shared&status&tagId&overdue&today&sort=updated_desc|deadline_asc&cursor&limit`. T10 implements owned/status/updated ordering; other view names return valid empty pages until collaboration grants exist. Tag/deadline controls are activated in T11/T12; unsupported early filter use returns clear validation error rather than being silently ignored.

**Migration/permissions:** Add index through `apps/api/migrations/0006_task_list_indexes.sql` for `(owner_id,updated_at DESC,id DESC)`. Every query starts with current-access predicates.

- [ ] Test 45 rows, 20/20/5 pages, equal timestamps, status filtering, invalid enum/limit/cursor, cursor reused for another actor/filter, and unauthorized rows excluded. Define live pagination semantics: stable keyset ordering for unchanged records; changes trigger list refresh, not snapshot guarantees. Run `make test-task TASK=T10` red.
- [ ] Add filter URL state, reset pagination on filter change, explicit load-more state, request cancellation on navigation, and safe error/empty text. Keep unavailable collaboration view controls hidden until those capabilities land.
- [ ] Run `make test-task TASK=T10`, `make e2e-task TASK=T10`, `make check`; no duplicate/missing unchanged tasks across tied-key pages.
- [ ] Commit `feat: add stable task list controls`.

### T11 — Save and display date-only deadlines

**Files:** `packages/contracts/src/dates.ts`, `packages/contracts/src/tasks.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/web/src/features/tasks/deadline.ts`, `apps/web/src/features/tasks/TaskEditor.tsx`, `apps/web/src/features/tasks/TaskFilters.tsx`, `apps/web/src/features/tasks/TaskListPage.tsx`, `tests/api/T11.test.ts`, `tests/web/T11.test.tsx`, `tests/e2e/T11.spec.ts`.

**Consumes/produces:** Activate optional `deadline:LocalDate|null` on create/patch; `localToday(date:Date):LocalDate`; `deadlineState(deadline,status,today):'none'|'future'|'today'|'overdue'`. `overdue=true` requires validated viewer `today`; `deadline_asc` orders `(deadline ASC NULLS LAST,id ASC)` with correct null cursor handling.

**Migration/permissions:** No new table; existing DATE field. Owner edits only; do not parse stored dates as midnight UTC Date objects.

- [ ] Test leap-day validity, impossible dates, clear deadline, required today for overdue, completed-task exclusion, null/tied deadline pages, and frozen clocks around midnight in positive/negative UTC offsets. Run `make test-task TASK=T11` red.
- [ ] Add date field and consistent localized calendar display without timezone conversion, due/overdue labels, sorting/filter controls. Browser supplies its local calendar date and recomputes it when refreshed.
- [ ] Run `make test-task TASK=T11`, `make e2e-task TASK=T11`, `make check`; saved `2028-02-29` remains that date in both tested timezones and done tasks never show overdue.
- [ ] Commit `feat: add calendar-date task deadlines`.

### T12 — Manage personal tags and task labels

**Files:** `apps/api/migrations/0007_tags.sql`, `packages/contracts/src/tags.ts`, `apps/api/src/modules/tags/routes.ts`, `apps/api/src/modules/tags/service.ts`, `apps/api/src/modules/tags/repository.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/web/src/features/tags/TagsPage.tsx`, `apps/web/src/features/tags/TagPicker.tsx`, `apps/web/src/features/tags/client.ts`, `tests/api/T12.test.ts`, `tests/web/T12.test.tsx`, `tests/e2e/T12.spec.ts`.

**Consumes/produces:** `GET /tags -> Page<Tag>`; `POST /tags {name} -> 201 Tag`; `PATCH /tags/:id {name} -> Tag`; task create/patch accepts `tagIds:Id[]` and task filter accepts `tagId`. Duplicate input IDs collapse; foreign tag IDs fail without revealing their name.

**Migration/permissions:** `tags(id,owner_id,name,name_key,created_at,updated_at)` unique owner/name_key and owner/id; `task_tags(owner_id,task_id,tag_id)` composite FKs enforce matching owners, unique task/tag, cascade task deletion. Tag listing/renaming is owner-only; labels on visible tasks can later be read by viewers without collection access.

- [ ] Test 1/40-character limits, trim/case duplicates including concurrent create, multiple attach/remove, rename reflected on tasks, filter results, wrong-owner tag ID and guessed rename 404, mutation retry, transactional rejection of mixed valid/invalid tags. Run `make test-task TASK=T12` red.
- [ ] Add tag collection screen and keyboard-operable picker, task tag serialization/filter join without duplicate task rows. Extend delete tests for task_tags cascade while tags remain.
- [ ] Run `make test-task TASK=T12`, `make e2e-task TASK=T12`, `make check`; complete personal planning journey with persisted description/status/deadline/tags and delete confirmation.
- [ ] Commit `feat: add personal tags and task filtering`.

### T13 — Add dependency edges and enforce safe status changes

**Files:** `apps/api/migrations/0008_dependencies.sql`, `packages/contracts/src/dependencies.ts`, `apps/api/src/modules/dependencies/routes.ts`, `apps/api/src/modules/dependencies/service.ts`, `apps/api/src/modules/dependencies/repository.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/db/owner-lock.ts`, `apps/web/src/features/dependencies/DependencyEditor.tsx`, `apps/web/src/features/dependencies/DirectLinks.tsx`, `apps/web/src/features/dependencies/client.ts`, `tests/api/T13.test.ts`, `tests/web/T13.test.tsx`, `tests/e2e/T13.spec.ts`.

**Consumes/produces:** `POST /dependencies {prerequisiteTaskId,dependentTaskId} -> 201 {prerequisiteTaskId,dependentTaskId}`; `DELETE /dependencies` with same pair -> 204; `GET /tasks/:id/dependencies -> {prerequisites,dependents,blocked}` with visible summaries or restricted markers. Both UI labels map to the same edge orientation. `assertEligible(tx,taskId,target):Promise<void>` joins the status service.

**Migration/permissions:** `task_dependencies(owner_id,prerequisite_task_id,dependent_task_id)` composite task FKs, unique pair, self-link CHECK, cascade on task delete, reverse index. Every graph/status/delete operation rechecks under the same owner lock. Only the common owner edits links.

- [ ] Test A→B, reverse label equivalence, self/duplicate/cross-owner denial, long/diamond cycles, duplicate retries, A→B concurrent with B→A, status concurrent with adding unfinished prerequisite, and task deletion during linking. Progress requires all direct prerequisites done. Until T14, a reopen requiring downstream reset returns `impact_confirmation_required` without changes. Run `make test-task TASK=T13` red.
- [ ] Implement locked recursive cycle checks and direct dependency UI with blockers. Reject unfinished prerequisite additions to progressed tasks; deletion removes edges but never changes surviving statuses. Wire eligibility into all existing status writes, with no alternate unguarded route.
- [ ] Run `make test-task TASK=T13`, `make e2e-task TASK=T13`, `make check`; barrier-controlled concurrent tests leave an acyclic, status-valid database and one clear conflict response.
- [ ] Commit `feat: add transactional task dependencies and blockers`.

### T14 — Preview and atomically confirm downstream resets

**Files:** `packages/contracts/src/dependencies.ts`, `apps/api/src/modules/dependencies/status-impact.ts`, `apps/api/src/modules/dependencies/routes.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/shared/preview-token.ts`, `apps/web/src/features/dependencies/StatusImpactDialog.tsx`, `apps/web/src/features/tasks/TaskDetailPage.tsx`, `tests/api/T14.test.ts`, `tests/web/T14.test.tsx`, `tests/e2e/T14.spec.ts`.

**Consumes/produces:** `POST /tasks/:id/status-preview {status} -> StatusPreview`; T08 status confirmation consumes `previewToken` whenever downstream reset is required. Return exact affected visible tasks and restricted impact count. At this stage only owners have access; T22 adds assignee privacy tests.

**Migration/permissions:** No table; signed expiring previews use validated environment secret. Changes and version increments occur in one owner-locked transaction; T24 adds transactional event calls once assignments exist. No preview performs a mutation.

- [ ] Test chain/diamond/branch reset, done and in-progress descendants, already-waiting intermediary, no-impact change, cancel, altered/expired/wrong-actor token, changed edges/status/description after preview, repeated confirmation with same operation ID, and forced failure after first reset rolling back all rows. Run `make test-task TASK=T14` red.
- [ ] Compute reset closure, bind preview fingerprint, and add focus-managed confirmation dialog. Stale confirmation returns new preview and requires another explicit confirm. T24 owns adding event calls through the T16 writer and verifying downstream assignee delivery; T14 does not import a module from a future task.
- [ ] Run `make test-task TASK=T14`, `make e2e-task TASK=T14`, `make check`; no partial reset and no silently expanded impact after a stale preview.
- [ ] Commit `feat: preview and confirm dependency status resets`.

### T15 — Navigate a dependency graph without duplicating tasks

**Files:** `packages/contracts/src/dependencies.ts`, `apps/api/src/modules/dependencies/graph.ts`, `apps/api/src/modules/dependencies/routes.ts`, `apps/web/src/features/dependencies/DependencyPage.tsx`, `apps/web/src/features/dependencies/GraphList.tsx`, `tests/api/T15.test.ts`, `tests/web/T15.test.tsx`, `tests/e2e/T15.spec.ts`.

**Consumes/produces:** `GET /tasks/:id/graph?cursor -> GraphPage` using the graph contract above. Use a normalized node list with prerequisite/dependent links and explicit repeated references, not a strict-tree representation. Graph cursors bind root, actor, and graph version; changed graph asks the client to reload.

**Migration/permissions:** None. Reuse current-access service for each node and endpoint. T18 extends fixtures to mixed-access graphs and activates restricted placeholders.

- [ ] Test single node, disconnected graph excluded, diamond shared node once, 250-node graph in 100-node pages, stable order, empty/missing root, invalid cursor, and unrelated root 404. Run `make test-task TASK=T15` red.
- [ ] Add graph navigation, root/back links, visible-reference labels, load-more, and accessible text structure at phone/desktop widths. Keep hidden metadata out of graph DTO definitions, not just hidden by CSS.
- [ ] Run `make test-task TASK=T15`, `make e2e-task TASK=T15`, `make check`; every visible node has one canonical entry and links clearly show both directions.
- [ ] Commit `feat: add accessible dependency graph navigation`.

### T16 — Search exact identities and send invitations with events

**Files:** `apps/api/migrations/0009_buddies_notifications.sql`, `packages/contracts/src/buddies.ts`, `apps/api/src/db/pair-lock.ts`, `apps/api/src/modules/buddies/routes.ts`, `apps/api/src/modules/buddies/service.ts`, `apps/api/src/modules/buddies/repository.ts`, `apps/api/src/shared/events.ts`, `apps/web/src/features/buddies/BuddiesPage.tsx`, `apps/web/src/features/buddies/InviteForm.tsx`, `apps/web/src/features/buddies/client.ts`, `tests/api/T16.test.ts`, `tests/web/T16.test.tsx`, `tests/e2e/T16.spec.ts`.

**Consumes/produces:** `GET /users/lookup?field=email|nickname&value -> {user:UserSummary|null}` is exact normalized lookup, not prefix discovery. `POST /invitations {recipientId} -> 201 InvitationDto`; `GET /invitations?direction=incoming|outgoing&state=pending&cursor -> Page<InvitationDto>`. DTO: `{id,sender:UserSummary,recipient:UserSummary,state,createdAt,updatedAt}`. Produce `emitEvent` and `withPairLock(tx,a,b,work)`.

**Migration/permissions:** `buddy_invitations(id,sender_id,recipient_id,pair_low,pair_high,state,created_at,updated_at)` with self CHECK, unique pending canonical pair; `taskbuddies(user_low,user_high,created_at)` unique canonical pair; `notifications(id,recipient_id,actor_id,type,subject_type,subject_id,created_at,acknowledged_at)` indexes by recipient/time/id. Notification subjects permit tombstones after deletion; actors remain valid users.

- [ ] Test exact/case-insensitive lookup, no substring search or email response leakage, anonymous denial, self/duplicate/reverse-pending/current-buddy conflicts, rate-limit boundary, operation replay, and stranger inability to list invitations. One request creates one invitation and one recipient event atomically. Run `make test-task TASK=T16` red.
- [ ] Add lookup/invite/list UI, pair locking, transactional notification writer and participant-scoped invitation queries. Historical state transitions are not deletes. Apply search/invitation rate counters and register event hooks for later producers.
- [ ] Run `make test-task TASK=T16`, `make e2e-task TASK=T16`, `make check`; invitation grants zero task access and private identities are not exposed by browsing.
- [ ] Commit `feat: add taskbuddy search and invitations`.

### T17 — Accept, decline, and cancel invitations

**Files:** `packages/contracts/src/buddies.ts`, `apps/api/src/modules/buddies/routes.ts`, `apps/api/src/modules/buddies/service.ts`, `apps/api/src/modules/buddies/repository.ts`, `apps/web/src/features/buddies/InvitationList.tsx`, `apps/web/src/features/buddies/BuddiesPage.tsx`, `tests/api/T17.test.ts`, `tests/web/T17.test.tsx`, `tests/e2e/T17.spec.ts`.

**Consumes/produces:** `POST /invitations/:id/accept|decline|cancel -> InvitationDto`; `GET /buddies?cursor -> Page<UserSummary>`; `requireBuddy(tx,userId,otherId):Promise<void>` for later shares/messages. Accept/decline are recipient-only; cancel sender-only.

**Migration/permissions:** T16 tables. Under canonical pair lock, update only pending invitation; acceptance creates exactly one mutual pair and sender event. Terminal rows remain, and declined/cancelled pairs can be reinvited.

- [ ] Test all transitions and wrong actors, accept-vs-cancel and accept-vs-decline race, accept retry one relationship/event, re-invitation after decline/cancel, and no private tasks appearing upon friendship. Run `make test-task TASK=T17` red.
- [ ] Add incoming/outgoing actions, contacts list and terminal-state UI. Emit accepted/declined to sender, never actor; show stale transitions as conflicts with a refreshed invitation.
- [ ] Run `make test-task TASK=T17`, `make e2e-task TASK=T17`, `make check`; both browser contexts show the mutual buddy after reload and a third user cannot act on the invitation.
- [ ] Commit `feat: add invitation responses and mutual taskbuddies`.

### T18 — Preview and grant a single-task share

**Files:** `apps/api/migrations/0010_task_access.sql`, `packages/contracts/src/access.ts`, `apps/api/src/modules/access/routes.ts`, `apps/api/src/modules/access/service.ts`, `apps/api/src/modules/access/repository.ts`, `apps/api/src/modules/tasks/access.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/api/src/modules/dependencies/graph.ts`, `apps/api/src/modules/dependencies/routes.ts`, `apps/web/src/features/access/ShareDialog.tsx`, `apps/web/src/features/access/client.ts`, `tests/api/T18.test.ts`, `tests/web/T18.test.tsx`, `tests/e2e/T18.spec.ts`.

**Consumes/produces:** `POST /tasks/:id/access-preview {recipientId,scope:'single',kind:'share'} -> AccessPreview`; `POST /tasks/:id/shares {recipientId,scope:'single',previewToken} -> {grantedTaskIds:Id[]}`. Owner confirms exact recipient and selected task; dependent graph sharing is enabled by T20. Activate shared task list view.

**Migration/permissions:** `task_access(task_id,user_id,granted_by,source,created_at)` unique task/user, cascades on task deletion. Effective read incorporates explicit shares; edit/status/access management stay owner-only. Snapshot grant and operation result share a transaction.

- [ ] Test owner-to-buddy share, nonbuddy/self/wrong owner rejection, preview cancel/no writes, stale/changed-recipient token, retry one grant, and read-only task/tag labels. For A→B→C with only B shared, all API payloads and UI show restricted boundary markers without A/C IDs or metadata; lists never expose A/C. Run `make test-task TASK=T18` red.
- [ ] Implement grant preview/confirmation and permission-filtered task/list/dependency DTOs. Shared viewer may read B but receives 403 on its field/status edits and 404 for invisible A/C. Do not expose the owner's tag-management endpoint.
- [ ] Run `make test-task TASK=T18`, `make e2e-task TASK=T18`, `make check`; sharing B exposes only B and its permitted labels/links.
- [ ] Commit `feat: add explicitly confirmed single-task sharing`.

### T19 — Review and revoke individual share grants

**Files:** `packages/contracts/src/access.ts`, `apps/api/src/modules/access/routes.ts`, `apps/api/src/modules/access/service.ts`, `apps/api/src/modules/access/repository.ts`, `apps/web/src/features/access/GrantList.tsx`, `apps/web/src/features/tasks/TaskDetailPage.tsx`, `tests/api/T19.test.ts`, `tests/web/T19.test.tsx`, `tests/e2e/T19.spec.ts`.

**Consumes/produces:** `GET /tasks/:id/shares -> Page<{taskId,user:UserSummary,source,createdAt}>` owner-only; `DELETE /tasks/:id/shares/:userId -> 204`. Share removal changes current access immediately on the next request. Active assignment fallback arrives in T23.

**Migration/permissions:** None. Owner-locked delete; revocation must be idempotent and cannot remove owner rights. Grant listings reveal no other tasks.

- [ ] Test revoke removes detail/list/graph reads, regrant works, wrong owner/viewer denial, absent grant no-op for owner, stale open page clears after 404, and replay of previous grant/read-bearing mutation cannot reveal content or recreate access. Run `make test-task TASK=T19` red.
- [ ] Add owner grant review with recipient and provenance, confirmation and revoke action. Extend idempotency hydration tests and client invalidation; in-flight older responses cannot restore content after access-loss response.
- [ ] Run `make test-task TASK=T19`, `make e2e-task TASK=T19`, `make check`; the recipient's open task becomes unavailable, with no task description in the error state.
- [ ] Commit `feat: review and revoke task shares`.

### T20 — Confirm and share the complete connected graph

**Files:** `apps/api/src/modules/access/preview.ts`, `apps/api/src/modules/access/service.ts`, `packages/contracts/src/access.ts`, `apps/web/src/features/access/ShareDialog.tsx`, `apps/web/src/features/access/GraphAccessPreview.tsx`, `tests/api/T20.test.ts`, `tests/web/T20.test.tsx`, `tests/e2e/T20.spec.ts`.

**Consumes/produces:** Extend access preview/grant to `scope:'graph'`; use `previewAccess` contract and `preview-token.ts`. Both directions participate in connected-component traversal; response enumerates every task and the recipient. UI always offers single/graph when links exist and defaults to no confirmed grant.

**Migration/permissions:** Existing task_access rows, `source=graph` for newly inserted auxiliary grants. Preserve pre-existing explicit rows and provenance; unique row per task/recipient. All writes under one owner lock.

- [ ] Test branching/diamond graph and disconnected task excluded, every task named, later edge does not extend access, changed membership/description/recipient invalidates preview, 250-node preview does not silently truncate, lost response retry no duplicates, and injected mid-grant failure leaves zero partial grants. Run `make test-task TASK=T20` red.
- [ ] Implement full graph traversal, signed snapshot, explicit confirmation, and per-task grant creation. Keep large preview scrollable/searchable without omitting records. Display persistence of individual grants and make each revocable through T19.
- [ ] Run `make test-task TASK=T20`, `make e2e-task TASK=T20`, `make check`; adding a new connected task after sharing requires a new explicit preview/confirmation.
- [ ] Commit `feat: add snapshot-based dependency graph sharing`.

### T21 — Request one assignee with an explicit sharing scope

**Files:** `apps/api/migrations/0011_assignments.sql`, `packages/contracts/src/assignments.ts`, `apps/api/src/modules/assignments/routes.ts`, `apps/api/src/modules/assignments/service.ts`, `apps/api/src/modules/assignments/repository.ts`, `apps/api/src/modules/tasks/access.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/web/src/features/assignments/AssignmentDialog.tsx`, `apps/web/src/features/assignments/PendingAssignmentsPage.tsx`, `apps/web/src/features/assignments/client.ts`, `tests/api/T21.test.ts`, `tests/web/T21.test.tsx`, `tests/e2e/T21.spec.ts`.

**Consumes/produces:** Reuse `/tasks/:id/access-preview` with `kind:'assignment'`; `POST /tasks/:id/assignments {recipientId,scope,previewToken} -> 201 AssignmentDto`; `GET /assignments?state=pending|accepted&cursor -> Page<AssignmentDto>`. DTO `{id,taskId,owner:UserSummary,recipient:UserSummary,state,createdAt,updatedAt}`; pending list includes authorized task summary.

**Migration/permissions:** `assignments(id,task_id,owner_id,recipient_id,state,created_at,updated_at)` with composite owner/task FK, partial unique task where pending/accepted, task-delete cascade. Pending grants temporary read only; graph auxiliary tasks get explicit read-only task_access rows, selected task gets assignment access unless separately shared already.

- [ ] Test buddy requirement, self/wrong owner denial, one pending/accepted slot, scope preview/staleness, only selected node requested, single assignment event, retry, and pending task read allowed while fields/status/comment writes denied. Run `make test-task TASK=T21` red.
- [ ] Add request dialog/pending list, access predicate and pending view in task queries. Emit assignment_received in the same transaction as request and auxiliary grants. Show exactly which grants will survive decline or later revocation.
- [ ] Run `make test-task TASK=T21`, `make e2e-task TASK=T21`, `make check`; request is pending after reload, no edit rights, graph peers read-only, unrelated task hidden.
- [ ] Commit `feat: request task assignments with access previews`.

### T22 — Accept or decline assignment and enforce assignee rights

**Files:** `apps/api/src/modules/assignments/routes.ts`, `apps/api/src/modules/assignments/service.ts`, `apps/api/src/modules/tasks/access.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/modules/dependencies/status-impact.ts`, `apps/api/src/modules/tasks/repository.ts`, `apps/web/src/features/assignments/PendingAssignmentsPage.tsx`, `apps/web/src/features/tasks/TaskDetailPage.tsx`, `tests/api/T22.test.ts`, `tests/web/T22.test.tsx`, `tests/e2e/T22.spec.ts`.

**Consumes/produces:** `POST /assignments/:id/accept|decline -> AssignmentDto`. Accepted recipient may change selected task status via the same locked service and previews as owner; may not edit description/deadline/tags/edges/shares. Activate assigned list view. Accepted `comment` permission is exposed for T26.

**Migration/permissions:** No schema changes. Under owner lock, only recipient changes pending state; decline removes implicit task access but preserves independent shares and auxiliary graph grants. Terminal response contains assignment metadata only, not newly inaccessible task content.

- [ ] Test accept/decline roles, race of both actions, duplicate result/event handling, assigned list movement, accepted status update and blockers, forbidden owner actions, decline with/without explicit share, and assignee reopen affecting hidden descendants with no hidden IDs/descriptions in preview/errors. Run `make test-task TASK=T22` red.
- [ ] Add actions and permissions-based controls, re-read access before replay and confirmation, integrate privacy-safe reset preview. Existing owner/graph guards remain authoritative.
- [ ] Run `make test-task TASK=T22`, `make e2e-task TASK=T22`, `make check`; accepted assignee changes status subject to prerequisites and can never modify graph peers simply because they were included in the grant.
- [ ] Commit `feat: add assignment responses and assignee permissions`.

### T23 — Cancel, replace, and revoke assignments

**Files:** `packages/contracts/src/assignments.ts`, `apps/api/src/modules/assignments/routes.ts`, `apps/api/src/modules/assignments/service.ts`, `apps/web/src/features/assignments/AssignmentControls.tsx`, `apps/web/src/features/access/GrantList.tsx`, `tests/api/T23.test.ts`, `tests/web/T23.test.tsx`, `tests/e2e/T23.spec.ts`.

**Consumes/produces:** `POST /assignments/:id/cancel|revoke -> AssignmentDto`; `POST /assignments/:id/replace {recipientId,scope,previewToken} -> AssignmentDto` cancels pending row and creates a newly previewed request atomically. Owner only. Terminal assignment records never grant access.

**Migration/permissions:** None. Cancel allowed for pending, revoke for accepted; wrong state 409. Accepted replacement requires revoke then request. Preserve separate shares on selected task and graph peers; individual share revocation leaves assignment access if still current.

- [ ] Test cancel-vs-accept and revoke-vs-status races, replace conflict rollback, reassignment after terminal state, owner rights immutable, revocation without share removes all task/dependency access, with share retains read only, separate share revocation preserves pending/accepted reads, and previous operation replay cannot resurrect access. Run `make test-task TASK=T23` red.
- [ ] Add owner controls, impact text and permission refresh. Emit safe assignment_revoked to previous recipient for cancel/revoke/replacement; private mailbox data is unaffected. Purge recipient cached content when no read grant remains.
- [ ] Run `make test-task TASK=T23`, `make e2e-task TASK=T23`, `make check`; two-browser acceptance/delegation/revocation journey survives reload and all rights match the brief's matrix.
- [ ] Commit `feat: cancel replace and revoke task assignments`.

### T24 — Display and acknowledge safe system notifications

**Files:** `packages/contracts/src/notifications.ts`, `apps/api/src/modules/notifications/routes.ts`, `apps/api/src/modules/notifications/service.ts`, `apps/api/src/modules/notifications/repository.ts`, `apps/api/src/shared/events.ts`, `apps/api/src/modules/tasks/service.ts`, `apps/api/src/modules/dependencies/status-impact.ts`, `apps/web/src/features/notifications/NotificationsPage.tsx`, `apps/web/src/features/notifications/client.ts`, `tests/api/T24.test.ts`, `tests/web/T24.test.tsx`, `tests/e2e/T24.spec.ts`.

**Consumes/produces:** `GET /notifications?cursor -> Page<NotificationDto>` newest first, 20 default; `POST /notifications/:id/acknowledge -> NotificationDto`. Event writer exists in T16; wire `task_changed` for owner field/status updates to accepted assignee or assignee status updates to owner, and `task_reset` to affected current accepted assignees other than actor. Read-only shared viewers do not receive general change events by default.

**Migration/permissions:** Existing notifications table. Recipient-only read/ack; dynamic subject authorization before serialization and before replay. Every producer's business update/event/result uses the same transaction.

- [ ] Cover invitation received/accepted/declined, assignment received/revoked, task changes and downstream resets, actor exclusion, rollback/no phantom events, retry/no duplicates, acknowledge ownership, deleted task, revoked task and invalid subject IDs. Stored and delivered safe history must not retain descriptions/bodies after access loss. Run `make test-task TASK=T24` red.
- [ ] Add separate notification screen, unread marker, safe historical text, and links only when authorized. Add missing transactional event calls to task/status services and test recipient membership changes around delivery.
- [ ] Run `make test-task TASK=T24`, `make e2e-task TASK=T24`, `make check`; guessing a notification ID returns 404, revoked subjects have no task ID/link/content, and lists stay private.
- [ ] Commit `feat: add private system notifications`.

### T25 — Send private messages and browse inbox/outbox

**Files:** `apps/api/migrations/0012_messages.sql`, `packages/contracts/src/messages.ts`, `apps/api/src/modules/messages/routes.ts`, `apps/api/src/modules/messages/service.ts`, `apps/api/src/modules/messages/repository.ts`, `apps/web/src/features/messages/MessagesPage.tsx`, `apps/web/src/features/messages/ComposeMessage.tsx`, `apps/web/src/features/messages/MessagePage.tsx`, `apps/web/src/features/messages/client.ts`, `tests/api/T25.test.ts`, `tests/web/T25.test.tsx`, `tests/e2e/T25.spec.ts`.

**Consumes/produces:** `POST /messages {recipientId,body} -> 201 MessageDto`; `GET /messages?box=inbox|outbox&cursor -> Page<MessageDto>` fixed 20, newest first `(created_at DESC,id DESC)`; `GET /messages/:id -> MessageDto`; DTO `{id,sender:UserSummary,recipient:UserSummary,body,createdAt}`. No read-receipt mutation.

**Migration/permissions:** `messages(id,sender_id,recipient_id,body,created_at)` plus sender/recipient ordering indexes. Sending requires current buddy, no self/unrelated send; read requires sender/recipient. No task FK; messages survive task deletion and task-access revocation.

- [ ] Test same body/time in both boxes, 1/4000 limits, whitespace-only and HTML text, buddy restriction, guessed ID 404, 45-message pagination with tied times, send retry one message, failed transaction no partial mailbox effect, and retained message after revoking a task mentioned in its body. Run `make test-task TASK=T25` red.
- [ ] Add compose/detail/inbox/outbox, clear empty/error states, safe text rendering and immediate sender outbox invalidation after send. Recipient opens message without notifying sender.
- [ ] Run `make test-task TASK=T25`, `make e2e-task TASK=T25`, `make check`; third user cannot retrieve the message by list, cursor, or ID and no sent body appears in logs.
- [ ] Commit `feat: add private taskbuddy messaging`.

### T26 — Add flat chronological task comments

**Files:** `apps/api/migrations/0013_task_comments.sql`, `packages/contracts/src/comments.ts`, `apps/api/src/modules/comments/routes.ts`, `apps/api/src/modules/comments/service.ts`, `apps/api/src/modules/comments/repository.ts`, `apps/web/src/features/comments/CommentList.tsx`, `apps/web/src/features/comments/CommentForm.tsx`, `apps/web/src/features/comments/client.ts`, `apps/web/src/features/tasks/TaskDetailPage.tsx`, `tests/api/T26.test.ts`, `tests/web/T26.test.tsx`, `tests/e2e/T26.spec.ts`.

**Consumes/produces:** `GET /tasks/:id/comments?cursor -> Page<CommentDto>` fixed 20, `(created_at ASC,id ASC)`; `POST /tasks/:id/comments {body} -> 201 CommentDto`; DTO `{id,taskId,author:UserSummary,body,createdAt}`. No individual comment endpoint; unknown direct-ID routes return generic 404, so there is no unprotected alternate read path.

**Migration/permissions:** `task_comments(id,task_id,author_id,body,created_at)` task cascade, author retained, no parent/comment-edit/delete columns/routes. Owner or accepted assignee may post, all current readers may list. Lock and recheck prevents a concurrent revoke from authorizing a late comment.

- [ ] Test 1/4000 limits, 45 chronological comments and equal timestamps, author preservation after revoke, former assignee denial by task/comment ID, shared/pending read-only, revoked-during-post race, no parentId accepted, retry one comment/event, and deleting a task removes comments/edges/access/assignments/tags joins atomically while mail remains. Run `make test-task TASK=T26` red.
- [ ] Add plain-text list/form with no reply/edit/delete controls; notify only the other current owner/accepted assignee, never author or shared viewers. Handle 403/404 by refreshing permissions/clearing content, not retrying with new ID.
- [ ] Run `make test-task TASK=T26`, `make e2e-task TASK=T26`, `make check`; Alice then Bob comments appear oldest first after reload, viewer cannot post, revoked Bob cannot read old comments.
- [ ] Commit `feat: add flat task comments with current-access checks`.

### T27 — Refresh visible views without stale data or duplicate sends

**Files:** `apps/web/src/hooks/useRefresh.ts`, `apps/web/src/hooks/usePagedResource.ts`, `apps/web/src/features/tasks/TaskListPage.tsx`, `apps/web/src/features/tasks/TaskDetailPage.tsx`, `apps/web/src/features/buddies/BuddiesPage.tsx`, `apps/web/src/features/assignments/PendingAssignmentsPage.tsx`, `apps/web/src/features/messages/MessagesPage.tsx`, `apps/web/src/features/notifications/NotificationsPage.tsx`, `apps/web/src/features/comments/CommentList.tsx`, `tests/web/T27.test.tsx`, `tests/e2e/T27.spec.ts`.

**Consumes/produces:** `useRefresh({enabled,refresh,intervalMs:30000})` triggers focus, visible-page timer and manual refresh, aborts on unmount/session loss. `usePagedResource` deduplicates by stable ID and ignores responses from older request generations. Refresh invalidates old pagination and reloads from first page; preserve comment reading position when practical, do not claim a stable snapshot across edits.

**Migration/permissions:** None. Poll reads only; sends/actions remain explicit idempotent mutations. Session identity forms part of cache keys.

- [ ] Use fake timers for exact 30-second refresh, focus, hidden document pause, cleanup, overlapping slow responses, network failure with retry affordance, filter changes, session switches, and revoked detail clearing. Assert no polling after unmount and no automatic second send/comment. Run `make test-task TASK=T27` red.
- [ ] Apply hook to relevant task/invitation/assignment/message/notification/comment views, add manual refresh and unobtrusive error state. Clear unauthorized data and invalidate requests before updating UI; stale success cannot restore it.
- [ ] Run `make test-task TASK=T27`, `make e2e-task TASK=T27`, `make check`; two browser contexts see invites/messages/changes on focus or next timer, with no duplicate rows/sends or lost unsent form text.
- [ ] Commit `feat: refresh open views on focus and polling`.

### T28 — Verify browser journeys, accessibility, and privacy together

**Files:** `tests/e2e/T28.spec.ts`, `tests/api/T28.test.ts`, `tests/web/T28.test.tsx`, `tests/helpers/journeys.ts`, `docs/acceptance.md`; fix only defects in the responsible existing resource/component files, naming those fixes in the evidence entry.

**Consumes/produces:** Completed account/product contracts. Produce journeys 1–6 from brief §6, a reusable two-user-plus-stranger fixture, and keyboard/mobile acceptance report. This is integration coverage, not a deferred implementation phase for missing earlier tests.

**Migration/permissions:** No planned schema change. Re-run full owner/accepted/pending/shared/unrelated/anonymous permission matrix for all resource routes and nested graph/comment/notification payloads.

- [ ] Add browser journeys for personal planning; dependencies/cycle/reset; invitations; scoped assignment/accept/revoke; chronological comments; inbox/outbox. Include profile/password and session loss regression. Run `make e2e-task TASK=T28` to reveal integration gaps.
- [ ] Check 390×844 and 1280×800 viewports, keyboard-only forms/dialogs, focus return, labels, contrast, errors, empty/loading states, literal hostile HTML and large graphs/lists. Add automated accessibility assertions and record manual keyboard/visual observations separately.
- [ ] Run `make test-task TASK=T28`, `make e2e-task TASK=T28`, `make e2e`, `make check`; fix demonstrated integration defects and record results. Do not silently relax assertions to pass.
- [ ] Commit `test: verify Taskio product journeys and access matrix`.

### T29 — Package the production stack and enforce transport configuration

**Files:** `compose.production.yaml`, `infra/api.Dockerfile`, `infra/web.Dockerfile`, `infra/Caddyfile.production`, `infra/Caddyfile.host`, `.env.production.example`, `scripts/package-release.sh`, `scripts/check-production-config.sh`, `tests/ops/T29.sh`, `docs/operations.md`, `Makefile`.

**Consumes/produces:** T28 build and migration runner. Produce immutable image tags plus checksummed release archive containing only images, Compose/proxy config, scripts, migration metadata and manifest. Built static frontend and `/api/v1` share app port 9090; host Caddy forwards to loopback. API/DB have no published host ports.

**Migration/permissions:** Migration is a one-shot job, never concurrent API startup DDL. Production runtime role cannot alter schema. Persistent DB volume external to release directory; frontend public env contains no secrets. Public authenticated deployment is deferred by the user; private fixture mode is explicit and must never be a public deployment default.

- [ ] Test production Compose config, loopback-only 9090, private API/DB, non-root app containers, restart health, SPA fallback excluding unknown API paths, cache behavior, graceful shutdown, and archive excludes `.git`, `.env`, data and credentials. Production HTTP origin must fail authentication configuration rather than disable Secure cookies. Run `make test-ops TASK=T29` red.
- [ ] Build repeatable images/archive with pinned dependency lock and release ID. Configure host Caddy with an explicit HTTP site address on 80 forwarding to `127.0.0.1:9090`; do not accidentally enable automatic HTTPS. Rehearse authenticated journeys only in an isolated fixture; public authentication remains disabled/deferred. [Caddy automatic HTTPS documentation](https://caddyserver.com/docs/automatic-https) explains why an explicit HTTP address is required for the selected topology.
- [ ] Run `make test-ops TASK=T29`, `make check`; expected healthy packaged local rehearsal, preserved data, exact port topology, and release manifest checksums. This test is not evidence of a public server deployment.
- [ ] Commit `build: package production Taskio services`.

### T30 — Document Debian bootstrap and implement SSH release deployment

**Files:** `scripts/deploy.sh`, `scripts/remote-release.sh`, `scripts/rollback.sh`, `infra/taskio.env.example`, `tests/ops/T30.sh`, `docs/operations.md`, `Makefile`.

**Consumes/produces:** T29 release archive/config. `make deploy DEPLOY_HOST=... DEPLOY_USER=... DEPLOY_PATH=... RELEASE=...` validates nonempty operator inputs, uses verified SSH host keys, copies explicit artifacts, verifies checksums, takes a deployment lock, migrates, recreates services, checks health, and reports release/status. `make rollback RELEASE=...` changes application images only after schema compatibility check.

**Migration/permissions:** Authorized non-root operator, SSH keys, narrowly documented Docker privileges, firewall/ports, DNS/domain, disk/persistent paths and secret file permissions. Maintenance window stops application writers before migration; failed migration prevents new version startup. Never delete a DB volume on failure.

- [ ] In isolated SSH target fixture test transfer/quoting, absent config, invalid host key, concurrent deployment, checksum failure, migration failure, unhealthy release, interrupted connection and application rollback. Assert no Git remote command and no secret output. Run `make test-ops TASK=T30` red.
- [ ] Write bootstrap and deploy sequence: install Docker/Compose/Caddy for operator-selected supported Debian, provision env/storage, verify DNS/proxy, preflight health/disk/schema, upload/load manifest images, migrate, start, check. Stop on incompatible or non-reversible migration; keep maintenance mode and require tested backup restore/forward repair, never auto-downgrade schema. Record current/previous release manifests.
- [ ] Run `make test-ops TASK=T30`; document successful fixture release and failure paths. Actual authenticated public deployment is deferred by the user, independently of operator host/domain/SSH inputs. Record those inputs for a future authorized rollout without blocking completion of privately verified deploy tooling.
- [ ] Commit `ops: add Debian bootstrap and SSH deployment workflow`.

### T31 — Schedule backups and prove restore into an isolated stack

**Files:** `scripts/backup.sh`, `scripts/restore.sh`, `scripts/backup-prune.sh`, `infra/systemd/taskio-backup.service`, `infra/systemd/taskio-backup.timer`, `tests/ops/T31.sh`, `docs/operations.md`, `Makefile`.

**Consumes/produces:** T29 production DB/image/schema manifest and T26 all persistent entities. `make backup` writes checksummed custom-format PostgreSQL dump with release/schema metadata; configured encrypted off-server transfer must succeed before retention pruning. `make restore BACKUP=... TARGET=...` restores to a new explicitly named DB/volume, verifies checksums/version compatibility, migrates if compatible, and checks health/data.

**Migration/permissions:** No application migration. Operator backup role with required read privileges; restrictive backup file permissions. Daily timer, keep 7 daily and 4 weekly successful backups locally/off-server, preserve at least the last known-good copy; document daily schedule as up-to-24h data loss expectation. Production overwrite requires explicit target confirmation in the script; ordinary drill cannot target production.

- [ ] Seed users, credentials, task/dependency/tag/share/assignment, terminal invitation, comments, messages, notifications and operation keys; backup, restore to separate volume, compare IDs/content/relationships, login and read restored data. Test corrupted dump, wrong schema, off-server outage, retention boundary, failed backup never pruning last good file, and concurrent writes during consistent dump. Run `make test-ops TASK=T31` red.
- [ ] Implement custom-format dump, metadata/checksums, off-server transfer (SSH with encrypted storage configured by operator), daily timer and retention. Protect session-bearing backups as secrets; restoration invalidates sessions deliberately and requires login while retaining credentials/operation history. Restore drill must exercise that invalidation, integrity checks, and recovered messages/comments.
- [ ] Run `make test-ops TASK=T31`; use second isolated SSH/storage fixture as off-server destination. Record backup size, completion/restore durations, restored row checks and browser login proof in acceptance evidence. Document [PostgreSQL dump/restore procedure](https://www.postgresql.org/docs/18/backup-dump.html) and actual operator scheduling/copy destination inputs.
- [ ] Commit `ops: add verified backup and restore procedures`.

### T32 — Run clean-checkout release verification and record evidence

**Files:** `scripts/release-check.sh`, `tests/ops/T32.sh`, `docs/acceptance.md`, `docs/implementation-progress.md`, `README.md`, `Makefile`.

**Consumes/produces:** All earlier task evidence, current local commit, no Git remote. `make release-check` reports typecheck/lint/tests/build/browser/ops results, source revision, dependency/image versions, migration version and artifact checksums. Use a temporary directory made from the local commit and fresh disposable Compose volumes to test clean-install instructions.

**Migration/permissions:** Verify migration from empty DB and a saved prior-release fixture, persistence after container recreation, least-privilege runtime and backup restore. Never run drills against actual production data or claim a public rollout from fixture results.

- [ ] Assert release-check fails if a task test is missing/skipped, a migration checksum changes, a command fails, an archive lacks manifest, or transport/operator gates are incorrectly marked complete. Run `make test-ops TASK=T32` red.
- [ ] Connect the documented command to all gates and seven journeys: six product browser flows plus local clean-start/package/SSH deploy/health/backup-restore rehearsal. Reconcile every brief requirement against the coverage matrix below and actual test results.
- [ ] Run `make release-check` from clean local source, then `make test-ops TASK=T32`. Expected all automated gates exit 0 and evidence names real commands. Mark private rehearsal ready when its checks pass. Keep public release explicitly deferred per the user decision; it additionally requires a future authorized secure-transport policy and server bootstrap/deploy/health/backup-restore evidence. Missing server inputs and the deferred public launch are not test successes.
- [ ] Commit `test: add clean-checkout Taskio release acceptance`.

## Requirement coverage and handoff checkpoints

| Brief requirement | Owning tasks / final proof |
| --- | --- |
| Account uniqueness/validation/credentials | T03/T04; normalized and concurrent signup tests |
| Authentication, expiry, CSRF, rate limits, secure cookies | T03/T05/T06/T29; session and transport tests |
| Self profile, immutable email/ID, recovery notices | T04–T06 |
| Task CRUD/status and owner/assignee boundaries | T07/T08/T13/T22/T23/T28 |
| Pagination/filter/sort/date-only deadlines | T07/T10/T11; pagination extended in T18/T21/T22 |
| Personal tags and viewer labels | T12/T18 |
| Graph links/cycles/concurrency/blockers | T13; real concurrent DB checks |
| Reopen preview/reset/stale confirmation | T14/T22/T24 |
| Readable graph, shared nodes/restricted data | T15/T18/T20/T28 |
| Exact buddy search and all invitation transitions | T16/T17 |
| Explicit share scope, exact preview, grant revocation | T18–T20 |
| Pending/accepted/declined/cancelled/revoked assignment | T21–T23 |
| Notification event coverage and safe history | T16/T17/T21/T23/T24/T26 |
| Private mail, mailbox preservation and no receipts | T25 |
| Flat oldest-first comments, author preservation | T26 |
| Idempotent mutation retries and atomic events | T09 and every later mutation task |
| Poll/focus/manual refresh and stale cache removal | T27/T28 |
| Semantic forms, keyboard, responsive plain-text UI | Each UI task; T28 integrated checks |
| Configuration, logs, one-origin local stack/health | T01/T02/T29 |
| Production packaging, loopback proxy, SSH/no remote Git | T29/T30 |
| Controlled migrations and rollback | T02/T29/T30/T32 |
| Persistent volume, schedule/retention/off-server/restore | T01/T31/T32 |
| Local check command, seven journeys, clean checkout | T02/T28/T32 |

Planning self-review: all S01–S27 mapped, every task has a deliverable, prerequisites, exact files, interfaces, schema/permission impact, negative and positive checks, and runnable commands to be created by T01/T02. Product code and tests are intentionally absent at planning time. The user's decision to defer public authenticated deployment and the actual deployment inputs are explicitly isolated from the local implementation path.

Start the next session with **T01**. Finish that task and its evidence before opening a new session for T02; the planning session does not execute this backlog.
