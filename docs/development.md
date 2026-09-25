# Taskio development rules and shared contracts

> This file is the canonical source for Taskio's shared technical contracts.
> `AGENTS.md` owns repository workflow, and each `docs/tasks/Txx.md` owns its
> task-specific scope and acceptance criteria.

**Goal:** Build the first Taskio release as small, independently verifiable sessions, beginning with the local stack and account access.

**Architecture:** React/TypeScript/Vite browser client, one Fastify/TypeScript JSON API, and PostgreSQL, orchestrated by Docker Compose. The browser uses one origin on port 9090; authorization and transactional domain rules live in the API. Production releases are transferred over SSH without Git remote access.

**Tech stack:** npm workspaces; TypeScript; React; Vite; Fastify with TypeBox JSON schemas; `pg` with parameterized SQL and ordered SQL migrations; Argon2id; Vitest; React Testing Library; Playwright; PostgreSQL; Docker Compose; Caddy. T01 selects mutually compatible supported versions and pins them in the lockfile and container definitions; this plan does not pretend dependencies are already installed.

**Spec:** [Agreed project brief](project-brief.md), including decisions D1–D10 and candidate slices S01–S27. [Planning request](../prompts/task-separation.md).

## Repository baseline and boundaries

Planning baseline: inspected on 2026-09-25 at local commit `e50fad0`. At that point the repository contained the brief and planning prompt, with no application, package manifest, test runner, Compose stack, or migration history. Repository-wide `AGENTS.md` was added later. This split adds documentation and the `tasker` agent only; T01–T32 remain unimplemented. Inspect the current checkout and `docs/implementation-progress.md` in future sessions rather than treating this historical baseline as current evidence. Preserve unrelated user changes, including edits to prompts.

All application paths in these contracts and task files are proposed, not discovered existing interfaces. A task creates its listed files if they do not yet exist and modifies them otherwise. Use the same names in later sessions. Do not scaffold unselected tasks. If an earlier implementation changes a contract, update this file and affected task files in the same local commit.

## Global constraints

- Follow the Git workflow in `AGENTS.md`. Production deployment transfers release artifacts over SSH; it never uses a remote Git checkout.
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

Follow `AGENTS.md` for interaction, authorization, branch/worktree handling,
local-only Git, commits, merging, and README maintenance. Agent definitions
should reference that workflow rather than reproduce it.

Use this request in a new Codex session, replacing the task path:

> Use the tasker subagent to implement docs/tasks/T01.md.

The project-scoped agent is defined in [`.codex/agents/tasker.toml`](../.codex/agents/tasker.toml). It reads the shared context itself; the parent should pass the task path and any user constraints in a fresh context instead of loading every task. Start a new session after adding or changing the agent definition so the client can discover it. The definition inherits the parent/default model and permissions. Standalone project agent files follow the [official Codex custom-agent format](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents); no global configuration change is required. If the client cannot select custom roles, delegate with the instructions from that TOML file explicitly, or execute the same workflow directly and report the limitation.

Each task is one session-sized deliverable, not a promise that every task takes equal time. Dependencies mean prerequisite code and its tests pass, not just that its checkbox was checked. Suggested order is T01 through T32; each task file lists its direct prerequisites. The [index](superpowers/plans/2026-09-25-taskio-implementation.md) permits independent later branches of work without requiring parallel agents. T16 follows T15 so numbered migrations stay monotonic; do not apply a higher-numbered migration before its earlier planned migrations exist.

For every selected task, add these Taskio-specific steps to the repository
workflow:

1. Use `superpowers:executing-plans` when available, then verify the task's direct prerequisites in source, tests, and the relevant `docs/implementation-progress.md` entries. Missing or failing prerequisite implementation is a blocker, not permission to expand the task.
2. Write the named positive, invalid-input, and permission/regression tests; run the task command and observe the intended failure. For infrastructure, use a failing smoke assertion/config check instead of artificial unit tests.
3. Implement only the selected behavior and its required UI, migration, contracts, and documentation. Re-run targeted checks, then `make check` once it exists; correct failures before completion.
4. Update `docs/implementation-progress.md` with the task ID, changed contract decisions, exact commands and results, and remaining operator inputs. T01 creates the file. Never record an unrun command as passing. Update verified task checkboxes and affected shared contracts.
5. Stop after the selected task; do not automatically start its successor.

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

Start implementation with [T01](tasks/T01.md). Finish that task and its evidence before selecting another task in a new session. The task-file split does not implement this backlog.
