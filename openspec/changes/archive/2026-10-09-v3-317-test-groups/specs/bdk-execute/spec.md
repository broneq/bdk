## ADDED Requirements

### Requirement: Wave check

Before it starts the first part of a wave, the lead SHALL record the wave's base, `git rev-parse HEAD` on the Change branch, in `state.json` as `waves.<n>.base` with `status` `pending`, unless the state already holds a base for that wave. After every part of the wave is `done` and on the Change branch (merged, or committed in the main checkout), the lead SHALL run `bdk check run <run dir> wave-<n> --at wave --changed <base>` in the main checkout. A `pass` or `none` verdict SHALL mark the wave `done`. On `fail` the lead SHALL start `bdk:implementer` running `resolve-conflict` with the arguments `<change> --wave <n> --base <base> --run-dir <absolute run dir>` (plus `--parts <dir>` when it runs other parts), with `model` and `effort` as for a conflict. On `Status: done` it SHALL commit the changed files on the Change branch with a message that names the wave, and mark the wave `done`; otherwise it SHALL run `resolve-conflict` once more on `policy.escalation.model` and `policy.escalation.effort`, committing on `Status: done`, and when that also fails, mark the wave `blocked` with the report's kind and evidence as `reason`, keep its uncommitted changes, and start no later wave. A wave with a blocked part SHALL get no wave check.

On a new execute run, a wave whose parts are all `done` and whose state is not `done` SHALL get its wave check (and repair) before any later wave starts. The uncommitted changes of a repair that failed stay in the main checkout for the user; the next run stops on them as on any uncommitted change (spec "Branch and worktrees").

#### Scenario: Green wave

- **WHEN** wave 1 holds parts `01` and `02`, both are merged, and the `tools.test` item `unit` (`when: [wave, review]`) passes
- **THEN** `checks/wave-1.json` holds `test unit` with `at` `wave` and the `changed` ref of `waves.1.base`, `state.json` marks wave 1 `done`, and wave 2 starts

#### Scenario: Red wave repaired

- **WHEN** `checks/wave-1.json` fails after parts `01` and `02` are merged
- **THEN** `resolve-conflict` runs with `--wave 1 --base <waves.1.base>`, the lead commits its repair on the Change branch, wave 1 is `done`, and wave 2 starts

#### Scenario: Red wave not repaired

- **WHEN** `checks/wave-1.json` stays red after two `resolve-conflict` runs
- **THEN** `state.json` marks wave 1 `blocked`, no part of wave 2 starts, and `execute/result.md` starts with `Status: blocked` and names `execute/wave-1.md`

## MODIFIED Requirements

### Requirement: Part state

The lead SHALL be the only writer of `<run dir>/state.json`, in the schema of spec `bdk-cli/run`: every part of the plan with `status` `pending`, `done` or `blocked`, `attempts` counting every implementer run of the part across execute runs, and a `reason` for a blocked part; and every wave that has started with its `base`, its `status` `pending`, `done` or `blocked`, and a `reason` for a blocked wave. A part SHALL become `done` only after its conformer reported `Verdict: PASS`; its state SHALL be written before the next batch starts. A wave SHALL become `done` only after its wave check (spec "Wave check"). On a new execute run the lead SHALL start from `state.json`: done parts are skipped, and pending and blocked parts run again with a fresh budget. A done worktree part whose branch is not yet merged into the Change branch SHALL be merged before the next wave.

#### Scenario: Resume after a break

- **WHEN** `state.json` marks part `01` `done` and part `02` `blocked`, and `/bdk:execute` runs again after the plan was fixed
- **THEN** part `01` gets no agent, part `02` runs from attempt 1 of the new budget, and its `attempts` in `state.json` goes on from the earlier count

#### Scenario: Resume before the wave check

- **WHEN** `state.json` marks parts `01` and `02` of wave 1 `done` and wave 1 `pending` with a base, and `/bdk:execute` runs again
- **THEN** no implementer starts for wave 1, the lead runs `bdk check run <run dir> wave-1 --at wave --changed <base>`, and only then starts wave 2

### Requirement: Result and blockers

The lead SHALL write `<run dir>/execute/result.md`, replacing an earlier one: the first line `Status: done` (every part done and merged, every wave `done`) or `Status: blocked`; then `## Waves` (each wave with its parts and its wave check: `checks/wave-<n>.json` with its verdict, and `execute/wave-<n>.md` when it was repaired), `## Parts` (one line per part: status, attempts, its last report, and its commit or merge), `## Blockers` (one line per blocked part or wave: kind, evidence and the command that unblocks it), and `## Decisions taken without the user` (plan problems that did not stop the stage, escalations, merge resolutions, wave repairs). An empty section SHALL hold `- None.` The lead SHALL reply with the status line and the result path only.

`/bdk:execute` SHALL reply with the result's status line, the result path, and on `Status: done` the next stage `/bdk:auto-review <change>`. On `Status: blocked` it SHALL name each blocker with its command. With `policy.questions: stop` it SHALL ask the user whether to retry the blocked parts or stop, and on a retry continue the same lead with `SendMessage`; with `policy.questions: decide-and-record` it SHALL stop and record that it did not retry. It SHALL NOT fix a part, a plan or a merge itself.

#### Scenario: Blocker reaches the main thread

- **WHEN** the lead's result says `Status: blocked` with part `02` blocked by a plan defect
- **THEN** the reply of `/bdk:execute` names part `02`, the plan defect and `/bdk:plan add-totals`, and does not claim the stage is done

#### Scenario: Wave blocker reaches the main thread

- **WHEN** the lead's result says `Status: blocked` with wave 1 blocked by a red wave check
- **THEN** the reply of `/bdk:execute` names wave 1, `execute/wave-1.md` and `/bdk:execute add-totals` to retry
