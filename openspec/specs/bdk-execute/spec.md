# bdk-execute Specification

## Purpose
Defines the execute stage of the `bdk` plugin: the thin orchestrator `/bdk:execute`, which starts one `bdk:lead` agent and passes its result or blocker on, and the lead skill `execute-waves`, which runs the plan parts of a Change in parallel waves, commits and merges them, and is the only writer of the part state.

## Requirements

### Requirement: Skills and agent

The `bdk` plugin SHALL ship the skills `execute` (`skills/execute/`, the user command `/bdk:execute`) and `execute-waves` (`skills/execute-waves/`, not user-invocable) and the agent `bdk:lead` (`agents/lead.md`) with the default model `sonnet` and the tools `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `Skill` and `Agent`. `bdk:lead` SHALL run the stage skill its prompt names with the `Skill` tool. `execute-waves` SHALL run only on `bdk:lead`; started anywhere else it SHALL do nothing and name `/bdk:execute`.

#### Scenario: Lead started with its skill

- **WHEN** `/bdk:execute add-totals` runs in a configured project
- **THEN** the main conversation starts one `bdk:lead` agent whose prompt names the skill `bdk:execute-waves` and the arguments `add-totals --run-dir <absolute .bdk/runs/add-totals>`, and the main conversation starts no implementer and edits no file

### Requirement: Start of the stage

`/bdk:execute [<change>]` SHALL get the configuration from its own `bdk config show` block and, in a project that is not configured or whose configuration is invalid, stop with the line that command prints, starting nothing. Without a Change name it SHALL take the only Change under `openspec/changes/` other than `archive/`; with none or several it SHALL name what it found and stop. A Change without plan parts SHALL stop with `/bdk:plan <change>` as the stage to run first. When `.bdk/runs/run.json` queues the Change, it SHALL read the Change's stage from `bdk run status --json` and stop, naming the stage and its command, unless the stage is `execute`. It SHALL start the lead in the background when `execution.lead` is `background` and in the foreground when it is `foreground`, with `model` set to `models.lead` when the configuration sets it, and SHALL wait for the lead's result.

#### Scenario: No plan yet

- **WHEN** `/bdk:execute add-totals` runs and `openspec/changes/add-totals/plan/parts/` holds no part
- **THEN** no agent starts and the reply names `/bdk:plan add-totals`

#### Scenario: Foreground lead

- **WHEN** the project layer sets `execution.lead: foreground`
- **THEN** the `Agent` call that starts `bdk:lead` does not run in the background

### Requirement: Waves and batches

The lead SHALL take the waves from `bdk plan check <change plan/parts dir> --json`. It SHALL stop before any part runs when a part has no wave or a `shared-not-alone` problem is reported, naming the problems and `/bdk:plan <change>`; every other problem (part limits, overlapping files) SHALL be recorded in the result and SHALL NOT stop the stage. It SHALL run the waves in order, skipping parts that `state.json` marks `done`. Within a wave it SHALL start at most `execution.max-parallel` part agents at once, as foreground `Agent` calls in one message; a wave with more parts SHALL run in batches in ascending part order. A part SHALL be implemented by `bdk:implementer` running `implement-part`, then conformed by `bdk:conformer` running `conform-part`, each started with a prompt naming its skill and the arguments `<change> <part-id> --run-dir <absolute run dir>`, plus `--workdir <worktree>` for a worktree part, and with `model` set to `models.implementer` or `models.conformer` when the configuration sets it.

#### Scenario: Two worktree parts in one wave

- **WHEN** parts `01` and `02` both have no dependency and `isolation: worktree`
- **THEN** the lead starts both implementers in one message, then both conformers in one message, and each implementer prompt names its own `--workdir`

#### Scenario: Wave larger than the limit

- **WHEN** a wave holds parts `01` to `07` and `execution.max-parallel` is 5
- **THEN** the lead starts the implementers of parts `01` to `05` in one message and those of `06` and `07` after them

#### Scenario: Plan with a cycle

- **WHEN** `bdk plan check --json` reports a `cycle` problem between parts `02` and `03`
- **THEN** no agent starts, `state.json` is unchanged, and the result names the cycle and `/bdk:plan`

### Requirement: Branch and worktrees

Before the first part, the lead SHALL require a working tree without changes other than ignored files and stop otherwise, naming the changed paths. When the current branch is the base branch (the default branch of `origin`, else `main`) or no branch, it SHALL create and switch to a branch named after the Change; when that branch exists already, it SHALL stop. A part with `isolation: shared` SHALL run in the main checkout. A part with `isolation: worktree` SHALL run in a git worktree at `<run dir>/worktrees/<part-id>` on a new branch `bdk/<change>/part-<part-id>` made from the Change branch's current commit; an existing worktree of a part that is not done SHALL be reused. Worker agents SHALL NOT change git history; only the lead commits, merges and removes worktrees.

#### Scenario: Change branch from the base

- **WHEN** `/bdk:execute add-totals` starts on `main` with a clean tree
- **THEN** the parts are committed and merged on a new branch `add-totals`, and `main` keeps its commit

### Requirement: Retries and escalation

A part SHALL get at most `policy.budgets.part-attempts` implementer runs in one execute run; the last run within the budget SHALL use the model `policy.escalation.model`. A part SHALL be retried when its implementer reports `Status: blocker` with `Kind: other`, or its conformer reports `Verdict: FAIL`, or either agent returns no report; a retry SHALL run the implementer on the same work directory and then the conformer again. A blocker of `Kind: plan-defect` or `Kind: environment` SHALL NOT be retried: the part SHALL be marked `blocked` at once. A part whose budget is spent SHALL be marked `blocked` with the last report's reason. After a wave with a blocked part the lead SHALL merge the parts of that wave that are done and SHALL NOT start a later wave.

#### Scenario: Plan defect stops the part

- **WHEN** the implementer of part `02` reports `Status: blocker` and `Kind: plan-defect`
- **THEN** no second implementer starts for part `02`, `state.json` marks `02` `blocked` with 1 attempt and a reason naming the plan defect, and no later wave starts

#### Scenario: Escalation on the last attempt

- **WHEN** `policy.budgets.part-attempts` is 3 and the conformer of part `01` reports `Verdict: FAIL` twice
- **THEN** the third implementer of part `01` starts with `model` set to `policy.escalation.model`

### Requirement: Commits and merge-back

When a part's conformer reports `Verdict: PASS`, the lead SHALL commit the part's changes: in its worktree for a worktree part, in the main checkout for a shared part, with a message that follows the style of the project's recent commits and names the part. After every part of a wave is done or blocked, the lead SHALL merge the branch of each done worktree part into the Change branch, in ascending part order, as a merge commit, then remove its worktree and branch. When a merge stops on conflicts, the lead SHALL start `bdk:implementer` running `resolve-conflict` with the arguments `<change> <part-id> --run-dir <absolute run dir>` in the main checkout. On `Status: done` it SHALL check that no unmerged path and no conflict marker is left, stage the resolved files and commit the merge; otherwise it SHALL run `resolve-conflict` once more on `policy.escalation.model`, and when that also fails, abort the merge, keep the part's branch and worktree, and mark the part `blocked` with the reason `merge conflict`.

#### Scenario: Merge conflict resolved

- **WHEN** parts `01` and `02` of one wave both added a function at the end of `src/ledger.js`, and merging part `02` after part `01` stops on a conflict
- **THEN** `resolve-conflict` runs for part `02`, the lead commits the merge, the Change branch holds both functions, and no worktree of the Change is left

### Requirement: Part state

The lead SHALL be the only writer of `<run dir>/state.json`, in the schema of spec `bdk-cli/run`: every part of the plan with `status` `pending`, `done` or `blocked`, `attempts` counting every implementer run of the part across execute runs, and a `reason` for a blocked part. A part SHALL become `done` only after its conformer reported `Verdict: PASS`; its state SHALL be written before the next batch starts. On a new execute run the lead SHALL start from `state.json`: done parts are skipped, and pending and blocked parts run again with a fresh budget. A done worktree part whose branch is not yet merged into the Change branch SHALL be merged before the next wave.

#### Scenario: Resume after a break

- **WHEN** `state.json` marks part `01` `done` and part `02` `blocked`, and `/bdk:execute` runs again after the plan was fixed
- **THEN** part `01` gets no agent, part `02` runs from attempt 1 of the new budget, and its `attempts` in `state.json` goes on from the earlier count

### Requirement: Result and blockers

The lead SHALL write `<run dir>/execute/result.md`, replacing an earlier one: the first line `Status: done` (every part done and merged) or `Status: blocked`; then `## Waves` (each wave with its parts), `## Parts` (one line per part: status, attempts, its last report, and its commit or merge), `## Blockers` (one line per blocked part: kind, evidence and the command that unblocks it), and `## Decisions taken without the user` (plan problems that did not stop the stage, escalations, merge resolutions). An empty section SHALL hold `- None.` The lead SHALL reply with the status line and the result path only.

`/bdk:execute` SHALL reply with the result's status line, the result path, and on `Status: done` the next stage `/bdk:auto-review <change>`. On `Status: blocked` it SHALL name each blocker with its command. With `policy.questions: stop` it SHALL ask the user whether to retry the blocked parts or stop, and on a retry continue the same lead with `SendMessage`; with `policy.questions: decide-and-record` it SHALL stop and record that it did not retry. It SHALL NOT fix a part, a plan or a merge itself.

#### Scenario: Blocker reaches the main thread

- **WHEN** the lead's result says `Status: blocked` with part `02` blocked by a plan defect
- **THEN** the reply of `/bdk:execute` names part `02`, the plan defect and `/bdk:plan add-totals`, and does not claim the stage is done

### Requirement: Parts of another directory

`execute-waves` SHALL take `--parts <dir>`, an absolute directory of part files in the plan part format, such as the fix parts of a review round. With it, the lead SHALL take the waves from `bdk plan check <dir> --json`, SHALL pass `--parts <dir>` to every `implement-part`, `conform-part` and `resolve-conflict` it starts, SHALL keep the part state in `state.json` and write the result to `result.md` in the directory that holds `<dir>` (never in `<dir>`, where `bdk plan check` reports any other `.md` file), and SHALL leave `<run dir>/state.json` and `<run dir>/execute/result.md` unchanged. Part reports and check results SHALL stay under `<run dir>/execute/` and `<run dir>/checks/`. Without `--parts` the parts SHALL be `openspec/changes/<change>/plan/parts/` and the state and result SHALL be as before.

#### Scenario: Fix pass of a review round

- **WHEN** the lead runs `execute-waves monthly-report --run-dir <run> --parts <run>/review/round-1/fixes/parts` and that directory holds part `03`
- **THEN** the implementer prompt names `--parts <run>/review/round-1/fixes/parts`, `<run>/review/round-1/fixes/state.json` marks `03` `done`, `<run>/review/round-1/fixes/result.md` starts with `Status: done`, and `<run>/state.json` is unchanged
