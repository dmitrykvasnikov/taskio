# Taskio implementation task index

The implementation plan is split into 32 session-sized task files. Shared architecture, constraints, interfaces, verification commands, and requirement coverage live in [development rules](../../development.md); the [project brief](../../project-brief.md) defines the product. T01–T32 remain unimplemented at the time of this documentation split. Use task checklists and `docs/implementation-progress.md` for subsequent evidence, not this historical status.

Start a new session with:

> Use the tasker subagent to implement docs/tasks/T01.md.

Pass one task-file path. `tasker` reads `AGENTS.md`, the brief, shared development rules, that task, and necessary prerequisite evidence. Its [agent definition](../../../.codex/agents/tasker.toml) and [session protocol](../../development.md#session-protocol) describe execution through local validation, commit, and merge. Do not load all task files in each session or automatically start the next task.

## Order, dependencies, and slice coverage

| Task | Deliverable | Prerequisites | Brief slices |
| --- | --- | --- | --- |
| [T01](../../tasks/T01.md) | Local stack and health | none | S01 |
| [T02](../../tasks/T02.md) | Migrations, contracts, test harness | [T01](../../tasks/T01.md) | S01, S27 foundation |
| [T03](../../tasks/T03.md) | Registration API and credentials | [T02](../../tasks/T02.md) | S02 |
| [T04](../../tasks/T04.md) | Registration page | [T03](../../tasks/T03.md) | S02 |
| [T05](../../tasks/T05.md) | Login, session, logout | [T04](../../tasks/T04.md) | S03 |
| [T06](../../tasks/T06.md) | Profile nickname/password | [T05](../../tasks/T05.md) | S04 |
| [T07](../../tasks/T07.md) | Create/list personal tasks | [T05](../../tasks/T05.md) | S05 |
| [T08](../../tasks/T08.md) | Task detail/edit/delete/status | [T07](../../tasks/T07.md) | S06 |
| [T09](../../tasks/T09.md) | Retry-safe mutation infrastructure | [T08](../../tasks/T08.md), [T06](../../tasks/T06.md) | cross-cutting |
| [T10](../../tasks/T10.md) | Task filters and cursor pagination | [T09](../../tasks/T09.md) | S07 |
| [T11](../../tasks/T11.md) | Date-only deadlines | [T10](../../tasks/T10.md) | S08 |
| [T12](../../tasks/T12.md) | Personal tags | [T11](../../tasks/T11.md) | S09 |
| [T13](../../tasks/T13.md) | Dependency edges and safe status gate | [T12](../../tasks/T12.md) | S10, S11 |
| [T14](../../tasks/T14.md) | Status impact preview and atomic reopen | [T13](../../tasks/T13.md) | S12 |
| [T15](../../tasks/T15.md) | Readable dependency view | [T14](../../tasks/T14.md) | S13 |
| [T16](../../tasks/T16.md) | Exact-user search and invitations/events | [T15](../../tasks/T15.md) | S14, S20 foundation |
| [T17](../../tasks/T17.md) | Invitation transitions and buddy list | [T16](../../tasks/T16.md) | S15 |
| [T18](../../tasks/T18.md) | Single-task share preview/grant | [T15](../../tasks/T15.md), [T17](../../tasks/T17.md) | S16 |
| [T19](../../tasks/T19.md) | Grant review/revoke and access regression | [T18](../../tasks/T18.md) | S16 |
| [T20](../../tasks/T20.md) | Whole-graph sharing | [T19](../../tasks/T19.md) | S17 |
| [T21](../../tasks/T21.md) | Assignment preview/request | [T20](../../tasks/T20.md) | S18 |
| [T22](../../tasks/T22.md) | Assignment accept/decline | [T21](../../tasks/T21.md) | S18 |
| [T23](../../tasks/T23.md) | Assignment cancel/replace/revoke | [T22](../../tasks/T22.md) | S19 |
| [T24](../../tasks/T24.md) | Notification list/acknowledge | [T23](../../tasks/T23.md) | S20 |
| [T25](../../tasks/T25.md) | Private inbox/outbox messages | [T17](../../tasks/T17.md), [T24](../../tasks/T24.md) | S21 |
| [T26](../../tasks/T26.md) | Flat task comments | [T23](../../tasks/T23.md), [T24](../../tasks/T24.md) | S22 |
| [T27](../../tasks/T27.md) | Focus/poll/manual refresh | [T25](../../tasks/T25.md), [T26](../../tasks/T26.md) | S23 |
| [T28](../../tasks/T28.md) | Browser accessibility/privacy journeys | [T27](../../tasks/T27.md), [T06](../../tasks/T06.md) | S27 product gates |
| [T29](../../tasks/T29.md) | Production package and proxy (private rehearsal) | [T28](../../tasks/T28.md) | S24 |
| [T30](../../tasks/T30.md) | Debian bootstrap and SSH deployment | [T29](../../tasks/T29.md) | S25 |
| [T31](../../tasks/T31.md) | Backup scheduling and restore drill | [T26](../../tasks/T26.md), [T29](../../tasks/T29.md) | S26 |
| [T32](../../tasks/T32.md) | Clean-checkout release rehearsal | [T30](../../tasks/T30.md), [T31](../../tasks/T31.md) | S27 |

Task files are authoritative for detailed scope and prerequisites; keep this navigation table in sync. T01–T06 cover accounts, T07–T12 personal planning, T13–T15 dependencies, T16–T23 collaboration, T24–T28 communication and product acceptance, and T29–T32 operations acceptance. Migration ordering and the requirement coverage matrix are in the shared development rules.
