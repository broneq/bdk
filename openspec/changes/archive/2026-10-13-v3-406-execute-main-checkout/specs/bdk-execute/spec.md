## MODIFIED Requirements

### Requirement: Retries and escalation

A part SHALL get at most `policy.budgets.part-attempts` implementer runs in one execute run; the last run within the budget SHALL use the model `policy.escalation.model` and the effort `policy.escalation.effort`, or `models.implementer.effort` when `policy.escalation.effort` is not set, and no effort when neither is set. A part SHALL be retried when its implementer reports `Status: blocker` with `Kind: other`, or its conformer reports `Verdict: FAIL`, or either agent returns no report; a retry SHALL run the implementer on the same files and then the conformer again, before any later part starts. A blocker of `Kind: plan-defect` or `Kind: environment` SHALL NOT be retried: the part SHALL be marked `blocked` at once. A part whose budget is spent SHALL be marked `blocked` with the last report's reason. When a part is blocked, the lead SHALL start no later part, of its wave or of a later one, and SHALL leave the part's uncommitted work in the main checkout. The second `repair-wave` run of a wave SHALL use the same escalated model and effort.

#### Scenario: Plan defect stops the part

- **WHEN** the implementer of part `02` reports `Status: blocker` and `Kind: plan-defect`
- **THEN** no second implementer starts for part `02`, `state.json` marks `02` `blocked` with 1 attempt and a reason naming the plan defect, and no later part starts

#### Scenario: Blocked part stops its wave

- **WHEN** wave 1 holds parts `01` and `02`, and part `01` is blocked with `Kind: environment`
- **THEN** no implementer of part `02` starts, `state.json` marks `02` `pending`, and part `01`'s changes stay uncommitted in the main checkout

#### Scenario: Escalation on the last attempt

- **WHEN** `policy.budgets.part-attempts` is 3, `policy.escalation.effort` is `high`, and the conformer of part `01` reports `Verdict: FAIL` twice
- **THEN** the third implementer of part `01` starts with `model` set to `policy.escalation.model` and `effort` `high`

#### Scenario: Single attempt is the escalated one

- **WHEN** `policy.budgets.part-attempts` is 1, `policy.escalation.model` is `sonnet` and `policy.escalation.effort` is `low`
- **THEN** the first and only implementer of each part starts with `model` `sonnet` and `effort` `low`

### Requirement: Part state

The lead SHALL be the only writer of `<run dir>/state.json`, in the schema of spec `bdk-cli/run`: every part of the plan with `status` `pending`, `done` or `blocked`, `attempts` counting every implementer run of the part across execute runs, and a `reason` for a blocked part; and every wave that has started with its `base`, its `status` `pending`, `done` or `blocked`, and a `reason` for a blocked wave. A part SHALL become `done` only after its conformer reported `Verdict: PASS` and its commit; its state SHALL be written before the next part starts. A wave SHALL become `done` only after its wave check (spec "Wave check"). On a new execute run the lead SHALL start from `state.json`: done parts are skipped, and pending and blocked parts run again with a fresh budget.

#### Scenario: Resume after a break

- **WHEN** `state.json` marks part `01` `done` and part `02` `blocked`, and `/bdk:execute` runs again after the plan was fixed
- **THEN** part `01` gets no agent, part `02` runs from attempt 1 of the new budget, and its `attempts` in `state.json` goes on from the earlier count

#### Scenario: Resume before the wave check

- **WHEN** `state.json` marks parts `01` and `02` of wave 1 `done` and wave 1 `pending` with a base, and `/bdk:execute` runs again
- **THEN** no implementer starts for wave 1, the lead runs `bdk check run <run dir> wave-1 --at wave --changed <base>`, and only then starts wave 2

### Requirement: Result and blockers

The lead SHALL write `<run dir>/execute/result.md`, replacing an earlier one: the first line `Status: done` (every part done and committed, every wave `done`) or `Status: blocked`; then `## Waves` (each wave with its parts and its wave check: `checks/wave-<n>.json` with its verdict, and `execute/wave-<n>.md` when it was repaired), `## Parts` (one line per part: status, attempts, its last report, and its commit), `## Blockers` (one line per blocked part or wave: kind, evidence and the command that unblocks it), and `## Decisions taken without the user` (plan problems that did not stop the stage, escalations, wave repairs). An empty section SHALL hold `- None.` The lead SHALL reply with the status line and the result path only.

`/bdk:execute` SHALL reply with the result's status line, the result path, and on `Status: done` the next stage `/bdk:auto-review <change>`. On `Status: blocked` it SHALL name each blocker with its command. With `policy.questions: stop` it SHALL ask the user whether to retry the blocked parts or stop, and on a retry continue the same lead with `SendMessage`; with `policy.questions: decide-and-record` it SHALL stop and record that it did not retry. It SHALL NOT fix a part, a plan or a wave itself.

#### Scenario: Blocker reaches the main thread

- **WHEN** the lead's result says `Status: blocked` with part `02` blocked by a plan defect
- **THEN** the reply of `/bdk:execute` names part `02`, the plan defect and `/bdk:plan add-totals`, and does not claim the stage is done

#### Scenario: Wave blocker reaches the main thread

- **WHEN** the lead's result says `Status: blocked` with wave 1 blocked by a red wave check
- **THEN** the reply of `/bdk:execute` names wave 1, `execute/wave-1.md` and `/bdk:execute add-totals` to retry

### Requirement: Parts of another directory

`execute-waves` SHALL take `--parts <dir>`, an absolute directory of part files in the plan part format, such as the fix parts of a review round. With it, the lead SHALL take the waves from `bdk plan check <dir> --json`, SHALL pass `--parts <dir>` to every `implement-part`, `conform-part` and `repair-wave` it starts, SHALL keep the part state in `state.json` and write the result to `result.md` in the directory that holds `<dir>` (never in `<dir>`, where `bdk plan check` reports any other `.md` file), and SHALL leave `<run dir>/state.json` and `<run dir>/execute/result.md` unchanged. Part reports and check results SHALL stay under `<run dir>/execute/` and `<run dir>/checks/`. Without `--parts` the parts SHALL be `openspec/changes/<change>/plan/parts/` and the state and result SHALL be as before.

#### Scenario: Fix pass of a review round

- **WHEN** the lead runs `execute-waves monthly-report --run-dir <run> --parts <run>/review/round-1/fixes/parts` and that directory holds part `03`
- **THEN** the implementer prompt names `--parts <run>/review/round-1/fixes/parts`, `<run>/review/round-1/fixes/state.json` marks `03` `done`, `<run>/review/round-1/fixes/result.md` starts with `Status: done`, and `<run>/state.json` is unchanged

### Requirement: Wave check

Before it starts the first part of a wave, the lead SHALL record the wave's base, `git rev-parse HEAD` on the Change branch, in `state.json` as `waves.<n>.base` with `status` `pending`, unless the state already holds a base for that wave. After every part of the wave is `done` and committed, the lead SHALL run `bdk check run <run dir> wave-<n> --at wave --changed <base>` in the main checkout. A `pass` or `none` verdict SHALL mark the wave `done`. On `fail` the lead SHALL start `bdk:implementer` running `repair-wave` with the arguments `<change> <n> --base <base> --run-dir <absolute run dir>` (plus `--parts <dir>` when it runs other parts), with `model` `models.implementer.model` and `effort` `models.implementer.effort`, each when set. On `Status: done` it SHALL commit the changed files on the Change branch with a message that names the wave, and mark the wave `done`; otherwise it SHALL run `repair-wave` once more on `policy.escalation.model` and `policy.escalation.effort`, committing on `Status: done`, and when that also fails, mark the wave `blocked` with the report's kind and evidence as `reason`, keep its uncommitted changes, and start no later wave. A wave with a blocked part SHALL get no wave check.

On a new execute run, a wave whose parts are all `done` and whose state is not `done` SHALL get its wave check (and repair) before any later wave starts. The uncommitted changes of a repair that failed stay in the main checkout for the user; the next run stops on them as on any uncommitted change (spec "Branch and working tree").

#### Scenario: Green wave

- **WHEN** wave 1 holds parts `01` and `02`, both are committed, and the `tools.test` item `unit` (`when: [wave, review]`) passes
- **THEN** `checks/wave-1.json` holds `test unit` with `at` `wave` and the `changed` ref of `waves.1.base`, `state.json` marks wave 1 `done`, and wave 2 starts

#### Scenario: Red wave repaired

- **WHEN** `checks/wave-1.json` fails after parts `01` and `02` are committed
- **THEN** `repair-wave` runs with the arguments `<change> 1 --base <waves.1.base>`, the lead commits its repair on the Change branch, wave 1 is `done`, and wave 2 starts

#### Scenario: Red wave not repaired

- **WHEN** `checks/wave-1.json` stays red after two `repair-wave` runs
- **THEN** `state.json` marks wave 1 `blocked`, no part of wave 2 starts, and `execute/result.md` starts with `Status: blocked` and names `execute/wave-1.md`

## ADDED Requirements

### Requirement: Waves and part order

The lead SHALL take the waves from `bdk plan check <change plan/parts dir> --json`. It SHALL stop before any part runs when a part has no wave, naming the problems and `/bdk:plan <change>`; every other problem (part limits) SHALL be recorded in the result and SHALL NOT stop the stage. It SHALL run the parts one at a time in plan order: the waves in ascending order, and the parts of a wave in ascending part id, skipping parts that `state.json` marks `done`. A part SHALL be implemented by `bdk:implementer` running `implement-part`, then conformed by `bdk:conformer` running `conform-part`, each started as one foreground `Agent` call with a prompt naming its skill and the arguments `<change> <part-id> --run-dir <absolute run dir>`, and with `model` set to `models.implementer` or `models.conformer` when the configuration sets it. The next part SHALL start only after the part before it is committed. The lead SHALL NOT read `execution.max-parallel`.

#### Scenario: Parts of one wave in order

- **WHEN** parts `01` and `02` both have no dependency and part `03` depends on `01`
- **THEN** the lead runs the implementer and the conformer of `01`, commits `01`, then runs `02` the same way and commits it, then runs `03`, and no two part agents run at the same time

#### Scenario: Plan with a cycle

- **WHEN** `bdk plan check --json` reports a `cycle` problem between parts `02` and `03`
- **THEN** no agent starts, `state.json` is unchanged, and the result names the cycle and `/bdk:plan`

#### Scenario: Plan written with isolation

- **WHEN** part `01` still holds `isolation: worktree` and `bdk plan check --json` reports a `frontmatter` problem of part `01` naming `isolation`
- **THEN** no agent starts and the result names the problem and `/bdk:plan`

### Requirement: Branch and working tree

Before the first part, the lead SHALL require a working tree without changes other than ignored files and stop otherwise, naming the changed paths, with one exception: when `state.json` records at least one attempt of the part that runs next and every changed path lies within that part's `files`, the changes SHALL be kept as that part's earlier work and the part SHALL continue from them. When the current branch is the base branch (the default branch of `origin`, else `main`) or no branch, it SHALL create and switch to a branch named after the Change; when that branch exists already, it SHALL stop.

Every part SHALL run in the main checkout, on the Change branch. The lead SHALL NOT create a git worktree or a part branch and SHALL NOT merge; it SHALL pass no `--workdir` to a worker. Worker agents SHALL NOT change git history; only the lead commits.

#### Scenario: Change branch from the base

- **WHEN** `/bdk:execute add-totals` starts on `main` with a clean tree
- **THEN** the parts are committed on a new branch `add-totals`, and `main` keeps its commit

#### Scenario: No worktree for a multi-part plan

- **WHEN** the waves are `1: 01 02` and `2: 03` and no part has run before
- **THEN** every implementer and conformer prompt holds no `--workdir`, no `git worktree` command runs, no branch `bdk/add-totals/part-*` exists, and the Change branch holds one commit per part with no merge commit

#### Scenario: Earlier work in the main checkout is kept

- **WHEN** parts `01` and `02` are `done`, part `03` is `blocked` with 1 attempt, and the main checkout holds uncommitted changes only in files of part `03`
- **THEN** the lead does not stop on uncommitted changes, part `03` runs from those changes, and its commit lands on the Change branch

#### Scenario: Changes outside the next part still stop the stage

- **WHEN** part `03` has 1 attempt and the main checkout holds an uncommitted change to a file outside part `03`'s `files`
- **THEN** no agent starts and the result names the changed paths

### Requirement: Commits

When a part's conformer reports `Verdict: PASS`, the lead SHALL commit the part's changes on the Change branch in the main checkout, with a message that follows the style of the project's recent commits and names the part, before the next part starts. A worker that committed, or a change the lead finds outside the part's `files` after its conformer, SHALL stop the stage with a blocker naming the paths.

#### Scenario: One commit per part

- **WHEN** parts `01`, `02` and `03` all pass their conformer
- **THEN** the Change branch gains three commits, in the order `01`, `02`, `03`, each naming its part, and no merge commit

## REMOVED Requirements

### Requirement: Waves and batches

**Reason**: Parts no longer run in parallel batches; they run one at a time in plan order.

**Migration**: Replaced by "Waves and part order". `execution.max-parallel` no longer limits the execute lead.

### Requirement: Branch and worktrees

**Reason**: No part runs in a git worktree any more: a worktree lacks the project's environment (#406).

**Migration**: Replaced by "Branch and working tree". A run directory of an earlier BDK that holds `worktrees/` or a branch `bdk/<change>/part-*` is not resumed from them; finish or discard such a run before upgrading.

### Requirement: Commits and merge-back

**Reason**: Parts are committed on the Change branch, so there is nothing to merge back.

**Migration**: Replaced by "Commits".
