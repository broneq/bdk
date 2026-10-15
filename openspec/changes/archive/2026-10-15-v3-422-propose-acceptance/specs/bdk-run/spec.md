## MODIFIED Requirements

### Requirement: Stop when a stage does not reach its end

When a stage skill ends and the stage of the current Change has not moved past it (a question or gate for the user, a blocked part, a spent budget, a failing check, a failed push), the skill SHALL stop the run: it SHALL start no other Change, and reply with the Change, the stage, the stage's own reason, and that `/bdk:run` continues once the cause is resolved. The one exception is a Change that needs the user ("Changes that need the user"): the run marks it and goes on with the next Change. The skill SHALL NOT answer a stage's question or pass a gate for the user; a stage asks or decides by its own policy.

#### Scenario: Blocked execute stops the run

- **WHEN** `/bdk:execute` ends with `Status: blocked` for the first Change of a two-Change queue
- **THEN** no stage skill runs for the second Change, and the reply names the first Change, `execute`, its blockers and `/bdk:run`

### Requirement: Final report

When every Change of the queue is `done`, waiting or marked `needs-user`, the skill SHALL reply with one line per Change in queue order: the pull request URL and base from `close/pr.md`, `waiting` with its blockers, or `needs-user` with each open scope-log entry (its id, the AC it names and its question) and that `/bdk:design <change>` in a session that can ask answers it; then every decision taken without the user, read from the run files of each Change (the decisions of the pull request body in `close/pr.md`, which `/bdk:close` gathers from `proposal.md`, `design.md` and `review/result.md`, so each decision is listed once); and, when a Change waits, that `/bdk:run` continues after its blockers are merged. It SHALL NOT merge a pull request.

#### Scenario: Two pull requests reported

- **WHEN** both Changes of a queue end `done`
- **THEN** the reply names both pull request URLs, each into the base branch

#### Scenario: Change that needs the user reported

- **WHEN** the first Change of a queue is marked `needs-user` with the open entry `SL-1` naming `AC-3`, and the second ends `done`
- **THEN** the reply names `needs-user`, `SL-1` and `AC-3` for the first Change and the pull request URL of the second

### Requirement: Eval cases of the run

The `bdk` eval suite SHALL hold `orchestrator` cases for `/bdk:run`, run with the offline `gh` stand-in and a bare remote inside the workspace: `run-two-prs` (a queue of two reviewed Changes ends with two pull requests into `main`), `run-resume` (a queue interrupted after the archive of its second Change resumes at the pull request, with nothing run again for the first Change), `run-waiting-blocker` (a Change blocked by an unmerged Change of the queue is not started and is reported as waiting), `run-queue-from-issues` (two issues are queued in "blocked by" order and the first Change gets its branch from `main` and its proposal) and `run-needs-user` (a queue whose first Change holds an open `By: needs-user` scope-log entry under `policy.questions: decide-and-record`: `run.json` marks it `needs-user`, no stage skill runs for it, and a stage skill runs for the second Change). Each SHALL grade the order of the stages, the files the run writes and the outcome.

#### Scenario: Cases load in CI

- **WHEN** `pnpm test` runs the free eval check
- **THEN** the five `run-*` cases load with no error at zero cost and their scaffolds exit 0

## ADDED Requirements

### Requirement: Changes that need the user

Before it calls a stage for a Change, and after a stage that did not move the Change on, the skill SHALL look in `openspec/changes/<change>/scope-log.md` for an open entry (an entry `By: needs-user` that no later entry `Answers: SL-<n>` settles; spec `bdk-propose`, "Scope log opened by propose"). With one, it SHALL set `"needs-user": "SL-<n>"` (the first open entry) on the Change's queue entry in `run.json`, call no stage for it, tell the user the Change, the entry and its question, and go on with the next Change of the queue. A later run SHALL skip a Change marked `needs-user` while its entry is open, and SHALL remove the key and continue the Change once the entry is settled. `bdk run status` ignores the key (spec `bdk-cli/run`, "run.json schema").

#### Scenario: Open entry skips the Change

- **WHEN** `/bdk:run` continues a queue of two Changes whose first Change's `scope-log.md` holds `SL-1` with `By: needs-user` and no answer
- **THEN** `run.json` marks the first Change `"needs-user": "SL-1"`, no stage skill runs for it, and a stage skill runs for the second Change

#### Scenario: Settled entry continues the Change

- **WHEN** a Change is marked `"needs-user": "SL-1"` and its `scope-log.md` now holds an entry with `Answers: SL-1` and `By: user`
- **THEN** the next `/bdk:run` removes the key and calls the Change's next stage
