# Taskio project brief

Status: product brief, decisions agreed on 2026-09-25. This document replaces the typo-named source `docs/project-biref.md` and defines the product and acceptance criteria from which small implementation tasks can be written. The domain name and SSH access details are operator inputs for deployment, not product decisions.

## 1. Purpose and release boundary

Taskio helps a small set of people plan personal work, express task prerequisites, delegate work to trusted contacts, and discuss it through private messages. A useful first release lets two people register, become taskbuddies, share and assign a task, understand what blocks it, exchange messages, and see their own work. The application runs locally during development and has a repeatable path to one Debian server. Git work and commits stay local; no Git remote operation is part of this project.

The target audience is individual users and small informal teams. There is no organization administrator, billing, calendar integration, file attachment, or public task sharing in the first release. The interface is a responsive browser application; native mobile apps are outside scope.

### Release milestones

1. **Personal tasks:** account access, task CRUD, status, deadline, tags, and personal task lists.
2. **Dependencies:** directed links, cycle prevention, blocked state, and a readable dependency view.
3. **Collaboration:** taskbuddy invitations, controlled task sharing/assignment, and access rules.
4. **Communication:** private messages, flat task comments, and task-related notifications.
5. **Operations:** local setup, automated checks, backups, and a repeatable Debian deployment.

Each milestone should leave a demonstrable, independently testable flow. The milestone order is a planning guide; detailed implementation tasks must state their own dependencies and acceptance tests.

## 2. Vocabulary and actors

- **User:** a person with one Taskio account, a unique email address and nickname.
- **Task owner:** the user who created a task and remains responsible for its definition and access policy. Ownership does not transfer when the task is assigned.
- **Assignee:** one taskbuddy asked to do the task. The request is pending until they accept or decline; after acceptance, they may change task status.
- **Taskbuddy:** two users whose invitation was accepted. The relationship is mutual; an invitation alone grants no task access.
- **Prerequisite:** task A is a prerequisite of B if A must be completed before B. The inverse UI label is “required by.”
- **Task share:** an explicit grant that allows another user to see a task. When the task has dependency links, the owner chooses the single task or the complete connected dependency graph.
- **Inbox/outbox:** received/sent private one-to-one messages. System notifications have a separate view.

## 3. Functional requirements

### 3.1 Accounts and identity

- A user has an immutable internal ID, email, nickname, password credential, and creation timestamp.
- Signup is open. Email and nickname are unique case-insensitively; surrounding whitespace is removed before validation. Email must have a syntactically valid address form and be at most 254 characters; nickname is 3–32 characters. The first release does not send email, verify address ownership, or offer email-based password recovery. The UI states that email is unverified and that forgotten-password self-service is unavailable.
- The system never stores or returns a plaintext password. Passwords are hashed using a current password hashing algorithm with an individual salt. Login errors do not reveal whether an email exists.
- A user can sign in and out, see their own profile, and update nickname and password. Changing email and self-service account recovery are deferred until an email delivery policy exists.
- All task, invitation, and message operations require authentication. Session expiry and explicit sign-out are supported.

### 3.2 Tasks

- A task has an immutable ID, nonempty description, owner, status (`waiting`, `in_progress`, `done`), optional deadline, zero or more tags, creation/update timestamps, and optional assignee/share records. A new task starts in `waiting`. Description length is 1–2,000 characters after trimming.
- Description is plain text in the first release; rich text and attachments are deferred. The UI preserves line breaks and escapes user content.
- An owner can create, view, edit, and delete their tasks. An accepted assignee may change status and add comments, but cannot edit task fields. A user can only see tasks owned by them, assigned to them, pending their acceptance, or explicitly shared with them.
- A user can filter their task list by status, assignee/ownership, tag, and overdue state, and sort by deadline or update time. Lists load 20 records by default and at most 100 per request, with a stable cursor or equivalent pagination.
- A deadline is a date-only value (`YYYY-MM-DD`), with no time of day or timezone conversion. The browser compares it with the viewer's local calendar date to show due today or overdue; a done task is not shown as overdue. Time-of-day deadlines are deferred.
- Deleting a task requires confirmation. Only the owner may delete it. The server removes its dependency links, comments, and access/assignment records in the same transaction; private messages remain in the sender's and recipient's mailboxes.

### 3.3 Tags

- A user creates and renames tags in their own tag collection and can add/remove multiple tags on a task they may edit. A tag name is 1–40 trimmed characters. Duplicate names within a user's collection are rejected case-insensitively.
- Tags belong to their creator in the first release. The original brief mentions a possible application-wide common tag set; shared/global tags are a later enhancement, not a requirement for the first release.
- When a task is shared, viewers can see its tag labels. A viewer does not gain the ability to edit the owner's tag collection.

### 3.4 Dependencies and status

- A dependency is stored once as `prerequisite_task_id -> dependent_task_id`. The UI may create it using either “depends on” or “required by.” Self-links, duplicate links, and any link that creates a directed cycle are rejected by the server.
- Both linked tasks must have the same owner, and only that owner may add or remove the link. Cross-owner dependencies are deferred. A viewer who has access to only one end sees a “restricted task” placeholder without the hidden task's description, status, deadline, tags, or owner.
- The task detail view lists direct prerequisites and dependents and offers navigation to visible tasks. A dependency view shows the reachable graph or a clearly indented tree projection. Shared nodes are not duplicated as separate tasks; the UI makes repeated references clear. Empty and large graphs remain readable.
- A task may enter `in_progress` or `done` only when every direct prerequisite is `done`. The UI shows blockers with links to visible prerequisite tasks. If a done prerequisite is moved back to `waiting` or `in_progress`, every reachable downstream task that is no longer eligible to progress is reset to `waiting`, including tasks that had been `done`. The user sees an impact preview before confirming the change; affected assignees receive notifications.
- Adding an unfinished prerequisite to a task already in progress or done is rejected with an explanation; the owner can first return the dependent task to `waiting`. Removing a prerequisite does not change task status. A status-impact preview is recomputed on confirmation, and a changed preview requires renewed confirmation.
- The server enforces cycle and status rules transactionally. Concurrent requests cannot introduce a cycle or leave a task progressed while an unfinished prerequisite blocks it. A status transition either completes with all required downstream resets or changes nothing.

### 3.5 Taskbuddies, sharing, and assignment

- A user can search for another existing user by exact email or nickname and send an invitation. A user cannot invite themselves, duplicate a pending invitation, or invite an existing taskbuddy.
- The recipient sees pending invitations and may accept or decline. Acceptance creates one mutual relationship atomically. The sender can cancel a pending invitation. Declined/cancelled invitations do not create access.
- Task access is explicit. Becoming taskbuddies does not expose either user's existing tasks. A user may share or assign a task only to a taskbuddy. A task has one owner and at most one requested/active assignee. An assignment request notifies the recipient and appears in their pending-assignment list with enough task detail to accept or decline. Acceptance moves it to their assigned list. Declining closes the request and removes task access unless the owner also shared it separately. The owner can cancel or replace a pending request.
- The owner can revoke a share or assignment. Revocation removes future access to task details and dependency data, while already delivered user messages remain in the recipient's mailbox.
- When the selected task has dependency links, the share/assignment flow asks the owner to choose **this task only** or **the whole dependency graph**. “Whole graph” means all tasks reachable through prerequisite or dependent links in either direction at that moment. The confirmation screen names every task that will become visible and the recipient; the user must confirm before access is granted. In an assignment, only the selected task becomes assigned; other graph tasks receive read-only share grants. Because a graph has one owner, that owner can grant the whole graph. Later dependency additions do not silently extend an existing grant; the owner must explicitly share newly linked tasks. The owner can review and revoke each grant.
- Group assignment is deferred beyond the first release. The first release has no group entity or group access policy.

### 3.6 Messages and notifications

- Every task has one flat comment list. The owner and the accepted assignee may add a plain-text comment of 1–4,000 trimmed characters. Pending assignees and users with a read-only share can read comments but cannot post. Comments show author, body, and creation time, ordered oldest to newest by `(created_at, id)`. The list loads 20 comments per page in that order. Comments cannot reply to another comment; there are no nested threads, mentions, edits, or deletion in the first release.
- A comment remains part of the task when its author is later revoked as assignee; that former assignee can no longer read the task or its comments unless separately shared. A new comment notifies the other current participant (owner or accepted assignee), never its author. Notification access follows current task access.
- Taskbuddies can send private, plain-text messages to each other. The sender sees them in outbox and the recipient in inbox. The message has sender, recipient, body of 1–4,000 trimmed characters, and timestamp. Editing or retracting sent messages is deferred.
- The recipient can open a message. The first release has no read receipts or live push. Messages are ordered newest first, with 20 records per page and a clear empty state. The inbox and notifications refresh on page focus and every 30 seconds while open; sending a message updates the sender's outbox immediately.
- System notifications cover at least invitation received/accepted/declined, assignment received/revoked, and relevant task changes when the recipient can still access the task. A notification links to its subject if access remains, otherwise it displays a safe historical summary.
- A user cannot send messages or expose task content to an unrelated account. Message body input is length limited and rendered as text.

## 4. Permissions and privacy contract

The backend is the authority for authorization; hiding a control in the UI is insufficient. Every read and write checks the requesting user's identity and task-level rights, including nested dependency and notification payloads. An inaccessible object returns a response that does not expose its existence or contents. Lists never include tasks merely because they are connected to a visible task.

| Action | Owner | Assignee | Shared viewer | Unrelated user |
| --- | --- | --- | --- | --- |
| Read task | Yes | Yes while assigned | Yes while shared | No |
| Edit description, deadline, tags | Yes | No | No | No |
| Change status | Yes | Yes after acceptance | No | No |
| Change dependencies | Yes | No | No | No |
| Read comments | Yes | Yes while assigned or pending | Yes while shared | No |
| Add comment | Yes | Yes after acceptance | No | No |
| Share/assign/revoke/delete | Yes | No | No | No |

An assignment request grants temporary read access while it is pending. It grants no editing right until accepted. Revocation or decline removes that grant unless a separate share exists.

## 5. Data model and invariants

The relational model needs tables for `users`, `sessions` (or equivalent session store), `tasks`, `tags`, `task_tags`, `task_dependencies`, `task_comments`, `buddy_invitations`, `taskbuddies`, `task_access`/`assignments`, `messages`, and `notifications`. A task comment stores task ID, author ID, body, and creation timestamp; it has no parent-comment field. All records use stable IDs and timestamps. Foreign keys and unique constraints enforce identity and association rules. Domain operations that touch multiple rows use transactions.

Required unique constraints include normalized email and nickname, one directed dependency edge per pair, one mutual taskbuddy pair, and at most one active invitation per user pair. Dependency cycle detection requires a transaction strategy that remains correct under concurrent link creation. Database migrations are versioned and run in a controlled deploy step; a failed migration stops deployment rather than serving incompatible code.

State transitions are explicit: invitation `pending -> accepted | declined | cancelled`; assignment `pending -> accepted | declined | cancelled`, or `accepted -> revoked`; a task may move directly between any two of `waiting`, `in_progress`, and `done`, subject to dependency rules. Terminal invitation/assignment rows remain for audit and notifications, but only current grants provide access. Re-inviting after a declined or cancelled invitation is allowed, subject to rate limits.

The task owner cannot be removed from task access. A dependency can only reference existing tasks. Deleting a user/account and data export are outside the first release; the data model should avoid making future retention policy impossible.

## 6. User journeys and acceptance examples

1. **Personal planning:** A new user signs in, creates a task, adds a deadline and personal tag, changes status, filters the list, and later deletes the task. A reload preserves each change.
2. **Dependency:** The user creates A and B, marks B as dependent on A, and sees both sides of the link. Attempting B -> A as another prerequisite is rejected with a useful error and leaves the graph unchanged.
3. **Invitation:** Alice invites Bob. Bob sees an invitation but no Alice tasks; after accepting, both see each other as taskbuddies. A duplicate or self invitation is rejected.
4. **Delegation:** Alice requests that Bob take a task and chooses the dependency sharing scope. The confirmation shows exactly what Bob can access. Bob gets a notification and sees the request in pending assignments. After he accepts, the task appears in his assigned list and he can update its status. Other graph tasks, if shared, remain read-only. Revoking access removes those task details from Bob's views.
5. **Task comments:** Alice comments on a task assigned to Bob; Bob adds another comment. Both see Alice's comment followed by Bob's with no reply control. A shared viewer can read but cannot add a comment. After Bob's assignment is revoked, he cannot fetch the comments by task or comment ID.
6. **Communication:** Alice sends Bob a message. It appears in Alice's outbox and Bob's inbox with the same body and timestamp; another user cannot read it by guessing its ID.
7. **Deployment:** A clean local checkout can run checks and start the stack from documented commands. An authorized operator can prepare the Debian host, deploy a new release, inspect health, back up data, and restore a backup in a documented drill.

The detailed task plan should turn each journey into small, reviewable slices with explicit positive, invalid-input, and unauthorized-access tests.

## 7. Interface outline

- Account screens: open registration, login, and profile/settings.
- Task list: “Owned by me” and “Assigned to me” views, status/tag/deadline filters, create action, and clear loading/error/empty states.
- Task detail/editor: description, owner, assignee, status, deadline, tags, prerequisite/dependent sections, share controls, a flat oldest-first comment list, and a comment form only for users allowed to post.
- Dependency view: navigate prerequisites and dependents without implying that a graph is a strict tree.
- Taskbuddies: search, outgoing/pending invitations, incoming invitations, accepted contacts.
- Messages: inbox, outbox, message detail, and compose form; notifications in a distinct surface.

Every form identifies required fields, validates before submission, and displays server validation errors. Keyboard navigation, visible focus, semantic labels, and readable contrast are required. The UI works at common phone and desktop widths. Dates use a consistent locale and timezone display.

## 8. Technical direction

The frontend is React + TypeScript + Vite. The backend is one TypeScript HTTP API using Fastify with schema-validated JSON endpoints, backed by PostgreSQL. Docker Compose runs the stack locally and on one Debian server. A single API keeps authentication and authorization in one place. PostgreSQL supplies relational constraints and transactions for assignments and dependency links. The backend framework is a routine implementation choice within the agreed single-API architecture.

The API is versioned under `/api/v1`. It exposes account/session, task, tag, dependency, invitation/taskbuddy, assignment/share, message, and notification resources. It uses JSON, stable IDs, explicit pagination, consistent validation/error responses, and server-side authorization. The frontend does not connect directly to the database. The client polls for message, notification, invitation, and task changes every 30 seconds while the relevant view is open, refreshes on focus, and offers manual refresh; WebSockets and server-sent events are outside the first release.

The contract can be split by resource: `auth` (register, login, logout, current user), `tasks` (list, create, read, edit, delete, status), `tags` (list, create, rename), `dependencies` (add, remove, graph, status-impact preview), `task-comments` (list, add), `taskbuddies` (search, invite, list, accept, decline, cancel), `assignments/shares` (request, accept, decline, grant, list, revoke), `messages` (send, inbox, outbox, read), and `notifications` (list, acknowledge). Invalid input returns field-specific errors; a duplicate or invalid transition returns a conflict; unauthenticated requests return an authentication error; inaccessible records do not reveal their contents. The client supplies a unique operation ID for retryable mutations; the API stores the result so a network retry cannot create duplicate invitations, assignments, shares, dependency links, comments, or messages.

Configuration comes from environment variables or deployment secrets and is documented without committing credentials. Local development serves the browser app at `http://localhost:9090` with sample values. The server deployment must not rely on editing application files on the host. A health endpoint checks API readiness and database connectivity. Logs include request correlation and operational errors without credentials or private message bodies.

### Deployment and operations

- The local workflow documents prerequisites, installation, database migration, app start, tests, and production build. The browser app is reachable at `http://localhost:9090`.
- A server bootstrap guide covers a non-root operator, SSH key access, Docker Engine/Compose installation, firewall, and persistent storage. The application serves the frontend and routes `/api/v1` on port 9090 in both environments. On the server, the app's port 9090 binds only to loopback, and Caddy listens on public port 80 and reverse proxies requests to `127.0.0.1:9090`. The API and database are on private Compose networks; port 9090 is not public. DNS must point the operator's domain to the server. The operator supplies the actual domain and SSH details during deployment.
- A local deployment script builds or packages the release, transfers only required artifacts over SSH, runs migrations safely, starts/recreates services, checks health, and reports failure. Its target host and paths are configuration, never hardcoded secrets. Remote Git access is not required.
- PostgreSQL data persists outside ephemeral containers. The operations guide defines scheduled backups, retention, off-server copy, and a tested restore procedure. Backup and restore are part of release acceptance, not just future documentation.
- The deployment guide includes how to roll back application images, how to handle a non-reversible migration, and how to inspect logs and health. Exact server credentials, hostname, and domain are provided by the operator when deployment is authorized.

Sources for the selected stack and operations: [Docker Compose production](https://docs.docker.com/compose/how-tos/production/), [PostgreSQL backup](https://www.postgresql.org/docs/18/backup-dump.html), [Fastify validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/), [Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## 9. Quality and release gates

- Automated backend tests cover invariants, permission checks including task comments, invitation/assignment transitions, and dependency cycles, including concurrent link attempts.
- Frontend tests cover core form/list behavior, chronological comment display, and access-dependent UI states. End-to-end tests cover the seven journeys in §6 against a real database where appropriate.
- CI or an equivalent local command runs type checking, linting, tests, and a production build. The README states the exact command and expected services.
- API input has explicit size limits. Password handling, secure session cookies, CSRF protection where cookie authentication is used, rate limiting for login and invitations, and safe error messages are required before public deployment.
- A release is ready when the core journeys pass, database migration from an empty database works, backup/restore is demonstrated, and deployment health checks pass. Performance work is guided by realistic small-team data; no speculative scaling subsystem is required.

## 10. Product decisions

| ID | Domain | Decision |
| --- | --- | --- |
| D1 | Ownership/groups | **Decided:** one stable owner, at most one accepting assignee, and no group assignment in the first release. |
| D2 | Dependency sharing | **Decided:** ask at share time whether to expose only the selected task or its whole dependency graph; display the full set before confirmation. |
| D3 | Backend/hosting | **Decided:** one API and PostgreSQL in Docker Compose on one Debian server. Fastify and TypeScript are the implementation choice for the API. |
| D4 | Status rules | **Decided:** block progress until prerequisites are done; reopening a prerequisite resets affected downstream tasks to `waiting`. |
| D5 | Assignee permissions | **Decided:** accepted assignee changes status and adds comments; owner edits task fields and access. |
| D6 | Messaging | **Decided:** private one-to-one inbox/outbox messages, with separate system notifications. |
| D7 | Account policy | **Decided:** open signup and syntactically valid but unverified email; no email delivery or self-service recovery in the first release. |
| D8 | Public deployment | **Decided:** the app serves on port 9090 locally and on the server; the server exposes port 80 through a reverse proxy to its loopback-bound port 9090. |
| D9 | Live updates | **Decided:** refresh/polling is sufficient; live push is outside the first release. |
| D10 | Task comments | **Decided:** owner and accepted assignee may post flat comments, shown oldest first; no replies to comments. |

The owner supplied these decisions in grouped architecture questions. Routine implementation choices such as Fastify, Caddy, same-owner dependency links, and date-only deadlines are recorded directly in this brief and can be revised during implementation planning if a concrete constraint appears.

## 11. Candidate implementation slices

Each row is a small, reviewable behavior with an observable result. The IDs show a useful order; detailed plans can adjust boundaries when the files and interfaces exist. Every slice includes its own relevant tests, validation, and authorization checks. Do not build a large frontend phase followed by a large backend phase.

| ID | Slice | Observable acceptance result |
| --- | --- | --- |
| S01 | Local stack and health | One documented command starts frontend, API, and PostgreSQL; the app opens at `http://localhost:9090`, and health reports database readiness. |
| S02 | Account registration | A valid email/nickname/password creates one user; invalid or duplicate values are rejected. |
| S03 | Login and session | A user signs in, reloads, remains signed in until expiry, and can sign out. |
| S04 | Profile | A signed-in user changes nickname/password; another user cannot edit the profile. |
| S05 | Task create and list | A user creates a `waiting` task and sees only their own tasks after reload. |
| S06 | Task detail, edit, delete | The owner edits and deletes a task; another user cannot read or modify it. |
| S07 | Task list controls | Status/owner filters, stable pagination, and sort work with more than one page. |
| S08 | Deadlines | Date-only deadlines save, display, sort, and distinguish due/overdue states. |
| S09 | Personal tags | Create/rename a tag, attach/remove it, and filter tasks without exposing tag management to viewers. |
| S10 | Dependency links | Add/remove links from either UI direction; self, duplicate, and cycle attempts fail, including concurrent attempts. |
| S11 | Blocked status | Unfinished prerequisites block progress; the API and UI identify visible blockers. |
| S12 | Reopen propagation | Preview and confirm a prerequisite reopen; affected descendants return to `waiting` atomically. |
| S13 | Dependency view | A branching/shared graph displays each task once and shows restricted placeholders where needed. |
| S14 | Taskbuddy search and invite | Exact email/nickname search and invitation enforce self/duplicate rules. |
| S15 | Invitation response | Accept/decline/cancel states and mutual taskbuddy lists survive reload and concurrent responses. |
| S16 | Single-task share | An owner grants/revokes read access; the recipient cannot edit or read unrelated tasks. |
| S17 | Graph share | A preview enumerates the connected graph; confirmation grants its current tasks and later links are not auto-shared. |
| S18 | Assignment request | The recipient sees a pending request and can accept/decline; only the accepted assignee changes status. |
| S19 | Assignment revocation | Owner cancellation/revocation removes access and preserves any separate share. |
| S20 | Notifications | Invitation, assignment, and task events reach only relevant users and handle revoked links safely. |
| S21 | Private messages | Sender outbox and recipient inbox agree; a third user cannot fetch a message by ID. |
| S22 | Task comments | Owner and accepted assignee post; viewers only read; comments paginate oldest first with no reply action or unauthorized access. |
| S23 | Refresh behavior | Visible lists refresh on focus and the 30-second poll without duplicate rows or sends. |
| S24 | Production packaging | A Compose production build serves the app and API on loopback-bound port 9090; Caddy proxies public port 80 at a configured domain to that listener, with private database/API ports. |
| S25 | Server bootstrap and deploy | Documented SSH deployment migrates, starts, checks health, and reports failure without using a Git remote. |
| S26 | Backup and restore | A scheduled backup has retention and an off-server copy; a restore drill reproduces account/task/comment/message data. |
| S27 | Release verification | Typecheck, lint, tests, build, seven user journeys, and operational checks pass from a clean checkout. |

Each detailed task plan must name exact files/interfaces after the repository structure exists, state its migration and permission impact, and give an observable acceptance result. The first release is complete only when all accepted requirements and operational gates above are covered.
