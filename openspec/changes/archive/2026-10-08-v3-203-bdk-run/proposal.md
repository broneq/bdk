## Why

Tracks #203.

Every stage of a BDK Change has its own command now (`/bdk:propose`, `/bdk:design`, `/bdk:plan`, `/bdk:execute`, `/bdk:auto-review`, `/bdk:close`), but the user still types each one and carries the queue of work in their head. The architecture (`docs/design/2026-10-07-v3-architecture.md`, "Autopilot" and "Autopilot continuation") names `/bdk:run` as the orchestrator that runs the stages in order over a queue of Changes in one session, writes `run.json`, and resumes from files after a break. D9 (`docs/design/2026-10-07-v3-skills-decisions.md`) decides how a queue with dependencies runs: no stacked PRs, every Change branches from the base branch, and a Change whose blocker in the queue is not merged yet waits.

## What Changes

- New skill `/bdk:run` (`plugins/bdk/skills/run/`), an orchestrator in the main thread: it builds a queue from an intent, an issue or a list of issues, orders it by "blocked by", writes `.bdk/runs/run.json`, and for each Change creates its branch from the base branch and runs the stage skills in order up to the pull request of `/bdk:close`.
- Resume: `/bdk:run` without an argument continues the queue in `run.json` at the open stage of each Change, as `bdk run status` derives it from files (resume table, spec `bdk-cli/run`).
- D9: a Change whose blocker in the queue has no merged pull request into the base branch is not started; the run goes on with the next independent Change and lists the waiting ones with their blockers.
- The run stops, with the command that continues it, when a stage stops without reaching its end (a gate or question for the user, a blocked part, a spent budget, a failing check).
- `/bdk:propose` takes `--name <change>`, so the Change it opens has the name the run queued.
- Orchestrator eval cases: a two-Change queue ends with two pull requests; a run interrupted mid-queue resumes at the right stage; a Change blocked by an unmerged Change of the queue waits; a queue built from issues is ordered by "blocked by".

## Capabilities

### New Capabilities
- `bdk-run`: the `/bdk:run` orchestrator - its input and queue, `run.json` as the run writes it, the branch of each Change, the stages in order, resume, waiting Changes (D9), stops, the final report and its eval cases.

### Modified Capabilities
- `bdk-propose`: the skill takes an optional `--name <change>` that names the Change it opens.

## Out of scope

- The stage skills themselves (#197-#202); `/bdk:run` composes them as they are, except for `--name` of `/bdk:propose`.
- A `Stop`/`SubagentStop` hook engine that pushes a stopped run on (architecture, "Autopilot continuation", deferred until measured).
- One session per Change and the measurement of Changes per session (architecture, "Risks", the bottleneck row): a later measurement.
- Merging pull requests, rebasing, or stacking branches (D9).
- `bdk run status` and the `run.json` schema it validates (#188): `run.json` gets two keys the command ignores, as its spec already allows; no CLI change.

## Impact

- `plugins/bdk/skills/run/SKILL.md` (new).
- `plugins/bdk/skills/propose/SKILL.md`: `--name`.
- `plugins/bdk/evals/`: a shared fixture with two reviewed Changes of one queue, four orchestrator cases, the README paragraph that runs them.
- `CLAUDE.md` "Current state".
- No `bdk` CLI change.
