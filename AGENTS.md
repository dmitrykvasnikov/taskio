# Agent instructions

These rules apply to the entire Taskio repository.

## Language

- Use English for all interaction with the user and other agents, including questions, progress updates, and final reports.
- Write repository documentation, code comments, commit messages, and branch names in English.

## Project context

- Read `docs/project-brief.md` before starting a task. It defines the product scope, architecture, and acceptance criteria.
- For implementation tasks, consult the relevant task in `docs/superpowers/plans/2026-09-25-taskio-implementation.md` and check its prerequisites.
- Keep each task focused on its agreed scope and observable acceptance criteria.

## Autonomy and confirmations

- Treat an assigned implementation task as authorization to carry it through implementation, validation, documentation, commit, and local merge. Continue until it is complete without pausing for routine approval.
- Do not ask the user to confirm commands needed to complete the assigned task. Run the necessary commands and resolve routine implementation choices independently within the agreed scope.
- Ask for confirmation only when an architectural change is needed, such as changing the agreed stack, service boundaries, deployment model, or core data and permission design. Explain the proposed change and its consequences before proceeding with the affected work.
- Keep the user informed through concise progress updates and a final report, without turning updates into approval checkpoints.
- Mandatory platform permissions and higher-priority safety requirements still apply. This rule does not bypass tool or sandbox approval controls; if they block progress, explain the specific blocker.

## Branches and commits

- Implement every task, including documentation and maintenance tasks, on a separate branch created from the current local `master`.
- Branch names must start with `codex-` and describe the task using concise, lowercase, hyphen-separated English words, for example `codex-add-agent-workflow` or `codex-add-session-login`.
- Inspect the branch and working tree before making changes. Preserve unrelated or uncommitted user work; use an isolated worktree if necessary.
- Commit only files belonging to the task, with a clear message describing the change.
- All Git work stays local, as required by the project brief. Do not fetch, pull, push, or create remote pull requests.

## Task completion and merging

- Complete the task's acceptance criteria, update affected documentation, and run the relevant available checks before merging. Report any checks that could not run and why; do not describe unverified work as passing.
- After a task is complete and its checks pass, commit its changes and merge its branch into local `master`. This is part of the task and does not require a separate routine confirmation.
- Prefer delegating the commit and merge to a fresh-context subagent using the Luna model (`gpt-6-luna`) with low reasoning effort when available. Supply only the repository path, task branch, exact files or commit IDs, commit message, validation results, and relevant constraints to keep token use low.
- The merge subagent must read this file, inspect the working tree, verify the intended changes, and merge only the specified task into `master`. Prefer a fast-forward merge when possible; otherwise use a regular merge without rewriting existing history.
- If Luna or delegation is unavailable, perform the same steps in the main agent. Escalate substantive conflicts to the implementing agent; do not resolve them blindly or overwrite unrelated work.
- Verify that `master` contains the task commits after merging. End on `master` when using the main checkout; with an isolated worktree, report the final branch and worktree state.
- The final report must summarize the change, validation results, and merge status.

## README maintenance

- Create `README.md` with the first implementation task and keep it current throughout development.
- Update it in the same task whenever dependencies, toolchain requirements, configuration, or developer commands change.
- Document all required dependencies and supported or pinned versions, including the runtime, package manager, Docker Engine/Compose, database, and any additional tools needed to build, run, test, or deploy the project.
- Provide working commands for installation, environment setup, starting services, database migrations, tests, type checking, linting, and production builds as those capabilities are introduced.
- Document required environment variables with safe sample values, expected services, and the local application URL (`http://localhost:9090`). Never commit credentials.
- Link to detailed deployment, backup, restore, and troubleshooting guides as they are added. Keep the README sufficient for a new developer to find all prerequisites and start from a clean checkout.
- Describe the current implementation accurately; clearly label planned capabilities and do not present unavailable commands as working.
