# Proposal

## Why

Scope: #166. Tracks #166.

A full run of `/bdk:execute` (B1 in `broneq/bdk-bench`: 7 parts, 27 tasks) took 47 minutes and 96 subagents, 3.5 per task: an implementer, a simplifier and a runner per task, each a cold start that reads its package, its rules and stores a report, each waking the main thread on opus. Only the implementer wrote product code; 30 of 35 simplifier runs changed nothing, and the runner (haiku) only ran `vitest` and `eslint`. On top of that the run lost time to defects of the current execute: 14 shell commands hung on stdin until the 120 s Bash timeout (one `bdk log ingest` lived 93 minutes after execute ended), the task package dropped the part preamble that named the copy source (blocker 04-1 and two plan-verify rounds), parallel runners wrote one shared check file and verified a tree other implementers were still editing, the simplifier checked no rules, and a plan acceptance line ran a paid command. The lead mode (T41) never ran and would not have helped: a lead dispatches the same three agents per task.

The fix is one agent per plan part, never per task, with the checks run by the kernel instead of an agent.

## What Changes

- **BREAKING** One execute model. A plan part runs as one `part` ticket: the main thread dispatches one `implementer` per part with the whole part file, and the agent works through the part's tasks in `Depends on:` order, test-first, running `bdk check run <task>` and committing each task. Then one `conformer` agent checks the part's diff against the rules and the task contracts, fixes what fits its contract, records the rest as findings, and ends with `bdk check run <part>`. The main thread closes the ticket and runs `bdk part done`. Parts of a wave run in parallel, as today.
- **BREAKING** Loops (`kernel-loops`): the loops `task-redispatch` and `part-lead` are replaced by one loop `part` (target: a part id, `policy.budgets.part`, default 3). Retry, `narrow`, `escalate` and `parked` apply per part; a later ticket of the part continues with the tasks not yet committed. `attempt close ok` of a `part` ticket requires every task of the part committed and fresh step evidence, and returns `next.action: part-done`; a task without its trailer commit refuses the close with `policy/tasks-uncommitted`.
- **BREAKING** Roles (`role-contracts`): the `lead` role and its `bdk:lead` adapter are removed; `implementer` becomes the part agent; `simplifier` is renamed `conformer`, with a contract that answers each selected rule, the project instructions and each task contract with a yes or a `file:line` violation. The `runner` role leaves execute and stays for the review stage's gate runner (#158 owns review).
- **BREAKING** Pipeline (`kernel-pipeline`): the post-task step `simplify` is renamed `conform`; `tests-scoped` and `lint` are recorded by `bdk check run`.
- **BREAKING** `bdk next` (`kernel-cli/graph`): a wave item loses `mode`; `execution.tree` is removed (`kernel-settings`), so the execute model no longer depends on `profile: large`.
- New command `bdk check run <task|part> --ticket <ticket> [--skip <tool-id>]` (`kernel-cli/check`, new group, slice `check`): runs the diff check of the target, then the project's scoped test and lint commands with stdin closed and a timeout of `execution.checks.timeout` seconds (default 300), stores each output under `.bdk/.machine/checks/<ticket>/`, records the `tests-scoped` and `lint` evidence itself (`source: kernel`), and for a passing task prints the exact `git commit` command with the BDK trailers.
- **BREAKING** Commits (`kernel-cli/commit`, `kernel-loops`): a part agent commits each task with a plain `git add` and `git commit` carrying `BDK-Change`, `BDK-Part` and `BDK-Task` trailers, as `bdk check run` prints it (user decision 2026-10-07); the conformer commits its fixes with `BDK-Change`, `BDK-Part` and `BDK-Ticket`. `bdk commit <task>` is removed; `bdk commit <change-id>` stays for review fixes. The diff check of a `part` ticket covers the part's commits since the ticket opened. `hooks pre-tool` lets the `bdk:worker` adapter run `git add` and `git commit` (never `--amend`, `--no-verify` or `--all`); every other git verb stays denied to subagents. `bdk part done` checkpoints the Change directory.
- `bdk dispatch build` (`kernel-cli/dispatch`): the `implementer` package of a part embeds the whole part file, preamble included, and a `Tasks` section marking each task committed or open; the `conformer` package adds the part's commit range and the project instruction files. Task targets no longer take packages, since no ticket targets a task.
- **BREAKING** `bdk log ingest --ticket <t> --file <path>` (`kernel-cli/log`): the report comes from a file only; stdin is never read. Every role contract names that one form, and writes the file with the host's Write tool to the `draft` path its package names under `.bdk/.machine/drafts/`; the read-only adapters gain `Write`, which `hooks pre-tool` allows only under that directory (`guard/draft-only`). Any other command that reads stdin (`log add --body -`, `rules accept -`, `review render --pr -`, `diagnostics write`) refuses a terminal at once and refuses when no data arrives within 3 seconds (`input/stdin-unavailable`), instead of waiting.
- `bdk evidence record` (`kernel-cli/evidence`): an agent's evidence file must lie under `.bdk/.machine/checks/<ticket>/`, the ticket's own directory (`policy/evidence-outside-ticket`).
- Plan parts (`kernel-loops`, `kernel-settings`): at most `plan.part.max-tasks` tasks (default 5, was the constant 8) and `plan.part.max-files` distinct `Files:` paths (default 10, new check `files`, `policy/part-too-many-files`); `/bdk:plan` and `/bdk:verify-plan` split a larger part. Plan acceptance lines name the exact commands to run; the verifier raises an acceptance that can run a costly command, or names commands by exclusion, as a `blocker` of the new default category `costly-command`; the implementer runs no command that spends money or reaches a shared system without an accepted `decision` naming it.
- Skills: `/bdk:execute` and `bdk:swarm` describe the one model; `skills/roles/lead` and its adapter are deleted; `implementer`, `conformer` (renamed from `simplifier`), `runner` and every other role contract name the one `log ingest --file` form.

Out of scope: review rounds, packages, judging and the review gate runner (#158); worktree creation (#165); archived machine records (#164); the diagnose transcript lookup (#157).

## Capabilities

### New Capabilities

- `kernel-cli/check`: `bdk check run`.

### Modified Capabilities

- `kernel-loops`: Loops, targets and rounds; Escalation ladder; Scope narrowing scenario; Diff check; Progress from git; Plan part checks.
- `kernel-cli/attempt`: bdk attempt open, bdk attempt close.
- `kernel-cli/dispatch`: bdk dispatch build.
- `kernel-cli/evidence`: bdk evidence record.
- `kernel-cli/log`: bdk log ingest.
- `kernel-cli/commit`: bdk commit, Serialised commits.
- `kernel-cli/part`: bdk part done.
- `kernel-cli/graph`: bdk next (the execute wave).
- `kernel-cli/hooks`: Pre-tool guards (subagent git, the lead verbs, the read-only Write rule).
- `kernel-cli`: Exit codes and the error object (`input/stdin-unavailable`, `policy/tasks-uncommitted`, `policy/evidence-outside-ticket`, `policy/part-too-many-files`, `guard/draft-only`), Invocation (stdin), Availability classes (`check run`, no lead exception).
- `kernel-pipeline`: Artifact kinds and the pipeline file (`conform`).
- `kernel-settings`: `execution.tree` removed, `policy.budgets` loops, `execution.checks.timeout`, `plan.part`, the default blocking category `costly-command`.
- `kernel-state`: Ledger entry, Attempt record (loop values, `base`), Evidence manifest kinds, Dispatch package (`draft`, size), Write map.
- `kernel-architecture`: Vertical slices and Dependency matrix (the `check` slice).
- `role-contracts`: Role skills, Role-to-adapter map, Adapters, Role contract content, Swarm skill, The verifier checks a whole plan.
- `stage-skills`: execute, plan, verify-plan requirements.

## Impact

- Code: `kernel/src/attempt/`, `kernel/src/dispatch/`, `kernel/src/evidence/`, a new `kernel/src/check/` slice, `kernel/src/log/`, `kernel/src/commit/`, `kernel/src/part/`, `kernel/src/graph/` (`wave.ts`, `kinds/steps.ts`, `kinds/parts.ts`, `config.ts`), `kernel/src/hooks/domain/guards.ts`, `kernel/src/export/domain/adapters.ts`, `kernel/src/shared/vocabulary/index.ts`, `kernel/src/shared/store/` (`progress.ts`, `store.ts`, attempt state), `kernel/src/main.ts`.
- Data and schemas: `pipeline/pipeline.yaml`, `schema/cli/commands.json` and the output schemas of `attempt`, `dispatch`, `log ingest`, `next`, `check run`; `schema/settings.json`; `schema/state/attempt.json`; the generated `agents/` adapters (`lead.md` removed).
- Skills: `skills/stages/execute`, `skills/swarm`, `skills/stages/plan`, `skills/stages/verify-plan`, `skills/roles/{implementer,conformer,runner,verifier,design-verifier,reviewer,integration-reviewer,scout}`, `skills/roles/lead` and `skills/roles/simplifier` removed; `skills/tools/cr` (the `--file` form of the merged review).
- Docs: `docs/guide/` pages on execute, roles, agents, configuration and the CLI reference.
- Evals: the `execute` stage cases and the `execute-ab` suite name `flat`, `tree` and the lead; they move to the one model.

## Resolution of "To resolve in the spec"

| Item                                        | Resolution                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What replaces `bdk commit` for a part agent | Resolved (user decision 2026-10-07): a plain `git commit` with the trailers `bdk check run` prints; the diff check moves into `bdk check run` and into the `part` ticket's close over its commit range. `bdk commit` keeps only the review-fix form. Design D-5.                                 |
| Name of the rule-checking step              | Resolved (user decision 2026-10-07): the role `simplifier` becomes `conformer`, the step and evidence kind `simplify` becomes `conform`.                                                                                                                                                         |
| `bdk log ingest` input                      | Resolved (user decision 2026-10-07): `--file` only; stdin is not read. The other stdin readers refuse a terminal and an empty pipe within 3 s. Design D-7.                                                                                                                                       |
| Part size limit                             | Resolved (user decision 2026-10-07): enforced by the kernel through `plan.part.max-tasks` (5) and `plan.part.max-files` (10), described in `/bdk:plan` and `/bdk:verify-plan`. Design D-9.                                                                                                       |
| Parts of one wave in their own worktrees    | Not needed: parts of a wave have disjoint `Files:`, each task's evidence hashes only its own files, and each check output has its ticket's own directory, so parts share the home tree as today. A part with `isolation: worktree` keeps working as before; one way to create worktrees is #165. |
| `conform` across parts                      | Out of the conformer's contract: a violation that needs a view across parts stays with the integration reviewer of `/bdk:cr` (#158); what a tool can decide goes to lint through `/bdk:add-rule`.                                                                                                |
