## MODIFIED Requirements

### Requirement: Waves and batches

The lead SHALL take the waves from `bdk plan check <change plan/parts dir> --json`. It SHALL stop before any part runs when a part has no wave or a `shared-not-alone` problem is reported, naming the problems and `/bdk:plan <change>`; every other problem (part limits, overlapping files) SHALL be recorded in the result and SHALL NOT stop the stage. It SHALL run the waves in order, skipping parts that `state.json` marks `done`. Within a wave it SHALL start at most `execution.max-parallel` part agents at once, as foreground `Agent` calls in one message; a wave with more parts SHALL run in batches in ascending part order. A part SHALL be implemented by `bdk:implementer` running `implement-part`, then conformed by `bdk:conformer` running `conform-part`, each started with a prompt naming its skill and the arguments `<change> <part-id> --run-dir <absolute run dir>`, plus `--workdir <worktree>` for a part that runs in a worktree, and with `model` set to `models.implementer` or `models.conformer` when the configuration sets it.

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

Before the first part, the lead SHALL require a working tree without changes other than ignored files and stop otherwise, naming the changed paths, with one exception: when `state.json` records at least one attempt of the part that runs next in the main checkout and every changed path lies within that part's `files`, the changes SHALL be kept as that part's earlier work and the part SHALL continue from them. When the current branch is the base branch (the default branch of `origin`, else `main`) or no branch, it SHALL create and switch to a branch named after the Change; when that branch exists already, it SHALL stop.

A part SHALL run in the main checkout when it has `isolation: shared`, or when it is the only part of its wave that `state.json` does not mark `done` and neither its worktree directory `<run dir>/worktrees/<part-id>` nor its branch `bdk/<change>/part-<part-id>` exists. The count SHALL be taken per wave, never per batch of `execution.max-parallel`. The lead SHALL NOT change the part file's `isolation`. Every other part SHALL run in a git worktree at `<run dir>/worktrees/<part-id>` on the branch `bdk/<change>/part-<part-id>`: an existing worktree directory SHALL be reused, an existing branch SHALL be checked out into a new worktree, and otherwise the branch SHALL be made from the Change branch's current commit. Worker agents SHALL NOT change git history; only the lead commits, merges and removes worktrees.

#### Scenario: Change branch from the base

- **WHEN** `/bdk:execute add-totals` starts on `main` with a clean tree
- **THEN** the parts are committed and merged on a new branch `add-totals`, and `main` keeps its commit

#### Scenario: A wave with one part runs in the main checkout

- **WHEN** the waves are `1: 01 02` and `2: 03`, every part has `isolation: worktree`, and no part has run before
- **THEN** parts `01` and `02` run in worktrees and are merged, part `03` runs with no `--workdir`, no worktree or branch `bdk/<change>/part-03` is made, part `03` is committed directly on the Change branch with no merge commit, and `plan/parts/03.md` still says `isolation: worktree`

#### Scenario: The worktree of a broken run is reused

- **WHEN** parts `01` and `02` are `done` and merged, part `03` is `pending` with 1 attempt, and `<run dir>/worktrees/03` on the branch `bdk/<change>/part-03` holds its earlier work
- **THEN** part `03` runs with `--workdir <run dir>/worktrees/03`, the earlier work is kept, and the part is merged into the Change branch and its worktree removed

#### Scenario: Earlier work in the main checkout is kept

- **WHEN** parts `01` and `02` are `done` and merged, part `03` is `blocked` with 1 attempt, and the main checkout holds uncommitted changes only in files of part `03`
- **THEN** the lead does not stop on uncommitted changes, part `03` runs in the main checkout from those changes, and its commit lands on the Change branch

#### Scenario: Changes outside the next part still stop the stage

- **WHEN** part `03` has 1 attempt and the main checkout holds an uncommitted change to a file outside part `03`'s `files`
- **THEN** no agent starts and the result names the changed paths

### Requirement: Commits and merge-back

When a part's conformer reports `Verdict: PASS`, the lead SHALL commit the part's changes: in its worktree for a part that runs in a worktree, on the Change branch in the main checkout for a part that runs there, with a message that follows the style of the project's recent commits and names the part. A part committed in the main checkout SHALL NOT be merged. After every part of a wave is done or blocked, the lead SHALL merge the branch of each done part that ran in a worktree into the Change branch, in ascending part order, as a merge commit, then remove its worktree and branch. When a merge stops on conflicts, the lead SHALL start `bdk:implementer` running `resolve-conflict` with the arguments `<change> <part-id> --run-dir <absolute run dir>` in the main checkout. On `Status: done` it SHALL check that no unmerged path and no conflict marker is left, stage the resolved files and commit the merge; otherwise it SHALL run `resolve-conflict` once more on `policy.escalation.model`, and when that also fails, abort the merge, keep the part's branch and worktree, and mark the part `blocked` with the reason `merge conflict`.

#### Scenario: Merge conflict resolved

- **WHEN** parts `01` and `02` of one wave both added a function at the end of `src/ledger.js`, and merging part `02` after part `01` stops on a conflict
- **THEN** `resolve-conflict` runs for part `02`, the lead commits the merge, the Change branch holds both functions, and no worktree of the Change is left
