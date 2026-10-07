## MODIFIED Requirements

### Requirement: bdk attempt open

Open a ticket for one loop iteration, or refuse with the next rung of the ladder. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt open <loop> <target> [--escalate]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<loop>` (required). Loop kind from policy: part, verify-fix, review-fix, verifier.
  - `<target>` (required). Part id for part and verify-fix, the Change id for review-fix, an artifact id for verifier.
  - `--escalate`. Open the round's one-shot escalation ticket (A-drabina); allowed only when the round's budget is used up or it oscillates.
- **Behaviour:** The kernel issues no dispatch package without an open ticket. Counts, rounds, scopes and the ladder follow `kernel-loops`. The ticket id is a merge-safe `A-` id (`kernel-state`, Identifiers); the record is written to `attempts/<loop>-<target>-<ticket>.md` with `attempt`, `of`, `scope`, `narrowed-from` and `dropped` stamped by the kernel. A `part` or `verify-fix` record also carries `base`, the commit `HEAD` of the part's work root points at when the ticket opens, from which the diff check of its close reads the part's commits (`kernel-loops`, Diff check; #166). A part target needs its part started (`part start`), a `verifier` target an artifact node that is not `blocked` or `skipped`, and a `review-fix` target every requirement of the `review` node done or skipped, except the change-level checks `tests-full` and `lint-full`, which the round's gate runner records (`kernel-pipeline`, Artifact kinds; T42), so the first not-done requirement is named in `policy/not-ready`; otherwise `policy/not-ready`. An unknown part or artifact is `input/not-found`; a target of the wrong type for the loop, a task id among them, is `input/invalid-argument`. Refuses with `policy/ticket-open` while a ticket of the same loop and target is open; tickets of other targets may be open at the same time (parallel waves). A `part` or `verify-fix` open refuses with `policy/files-busy` when a path of the `Files:` of every task of its part covers or is covered by a path of the `Files:` of another open `part` or `verify-fix` ticket's part, naming the path and that ticket: parts share one working tree, so two open tickets never hold one file (T41). After writing, the kernel checks again and removes its own record when an overlapping ticket was opened at the same time. A plain open refuses with `policy/budget-exhausted` when the round's budget is used up and with `policy/oscillation` when the round oscillates, `instead` naming `--escalate` when escalation is available (`kernel-loops`, Escalation ladder) and otherwise `change resume`. `--escalate` when the round's budget is not used up and the round does not oscillate, when escalation is disabled, already used in the round or over `policy.escalation.per-change`, is `policy/invalid-transition` naming the reason. An escalation ticket carries `escalation: true`, does not count against `of`, keeps the round's latest scope and returns `escalation.model` from `policy.escalation.model`; the checkpoint runs before it is issued (`kernel-loops`, Checkpoint). Narrowing drops findings as `kernel-loops`, Scope narrowing says, writing one kernel `finding` entry. After writing, the kernel re-reads the records of the key; when another open ticket of the key exists it removes its own record and refuses `policy/ticket-open`. For the loops that change code (`part`, `verify-fix`, `review-fix`) the output lists `steps`: the post-task step nodes of the pipeline that apply to the Change, in pipeline order, each with its evidence `kind` and either the `role` of the agent that runs it under this ticket (`conform`: `conformer`) or the `command` that records it (`tests-scoped`, `lint`: `bdk check run`) (`kernel-pipeline`, Artifact kinds); the `verifier` loop has no `steps`.
  **Merge conflict ticket (T45, user decision 2026-10-04).** A `verify-fix` open on a live worktree part whose merge back conflicts (`kernel-cli/part`, bdk part done) makes the ticket a merge ticket: unless a merge is already in progress in the worktree from an earlier ticket of the round, the kernel runs `git merge --no-commit <Change branch>` in the part's worktree, because subagents may not run `git merge` (`kernel-cli/hooks`, Pre-tool guards). The conflict markers stay inside that worktree; the home checkout and the other parts are untouched. The record carries `merge: true` and `conflicts`, the paths git reports unmerged, and the output returns both. Its `steps` are those of any code loop, so `tests-scoped` and `lint` run on the merged state. Budget, scope and ladder are those of `verify-fix`: an exhausted round parks the Change, and the park question names the worktree, the paths and `git merge --abort` as the user's way back.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `git:commit`, `git:merge`
- **Output:** `schema/cli/output/attempt-open.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/not-ready`, `policy/budget-exhausted`, `policy/oscillation`, `policy/ticket-open`, `policy/files-busy`, `policy/invalid-transition`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt open part 02 --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "loop": "part",
    "target": "02",
    "attempt": 2,
    "of": 3,
    "scope": "high+",
    "openedAt": "2026-09-25T10:02:11.482Z",
    "base": "4c1d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    "narrowedFrom": "full",
    "dropped": [
      {
        "id": "L-d3f6g8h2",
        "summary": "rename helper for clarity"
      }
    ],
    "steps": [
      {
        "kind": "conform",
        "role": "conformer"
      },
      {
        "kind": "tests-scoped",
        "command": "bdk check run"
      },
      {
        "kind": "lint",
        "command": "bdk check run"
      }
    ]
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt open part 02 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-open.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/not-ready

- **WHEN** `bdk attempt open part 02` runs before `bdk part start 02`
- **THEN** the exit code is 2, the error object carries `rule: policy/not-ready` and `instead` names `bdk part start 02`

#### Scenario: policy/budget-exhausted

- **WHEN** the loop's budget is used up
- **THEN** the exit code is 2 and the error object carries `rule: policy/budget-exhausted`

#### Scenario: policy/oscillation

- **WHEN** one finding fingerprint appears in `policy.oscillation.threshold` failed attempts of the round
- **THEN** the exit code is 2 and the error object carries `rule: policy/oscillation`

#### Scenario: policy/ticket-open

- **WHEN** a ticket of the same loop and target is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: policy/invalid-transition

- **WHEN** `bdk attempt open part 02 --escalate` runs while the round has budget left and does not oscillate
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: parallel targets

- **WHEN** a ticket of `part 02` is open, parts `02` and `03` declare disjoint `Files:` and `bdk attempt open part 03` runs
- **THEN** the exit code is 0

#### Scenario: a task target is refused

- **WHEN** `bdk attempt open part 02-3` runs
- **THEN** the exit code is 3, the error object carries `rule: input/invalid-argument` naming a part id, and no record is written

#### Scenario: base stamped

- **WHEN** `bdk attempt open part 02 --json` runs while `HEAD` is commit `4c1d2e3`
- **THEN** the record and the output carry `base` with that commit's full id

#### Scenario: escalation ticket

- **WHEN** the round of `part 02` has used its budget, escalation is enabled and `bdk attempt open part 02 --escalate --json` runs
- **THEN** the exit code is 0, the record has `escalation: true`, the output has `escalation.model: opus` under the default policy, and a second `--escalate` in the same round is `policy/invalid-transition`

#### Scenario: steps in pipeline order

- **WHEN** `bdk attempt open part 02 --json` runs on a Change with the shipped pipeline
- **THEN** `steps` is `conform` (role `conformer`), `tests-scoped` (command `bdk check run`), `lint` (command `bdk check run`), in that order

#### Scenario: verifier ticket has no steps

- **WHEN** `bdk attempt open verifier plan-verify --json` runs
- **THEN** the output has no `steps`

#### Scenario: policy/files-busy

- **WHEN** tasks `01-1` and `02-1` both declare `src/login.ts`, parts `01` and `02` are started and ticket `A-xxxxxxxx` of `part 01` is open
- **THEN** `attempt open part 02` exits 2 with `rule: policy/files-busy` naming `src/login.ts` and `A-xxxxxxxx`, and after that ticket is closed the same open exits 0

#### Scenario: a review round opens before the full gate

- **WHEN** every plan part of a Change is executed with its post-task steps, `tests-full` and `lint-full` have no manifest, and `bdk attempt open review-fix <change-id> --json` runs
- **THEN** the ticket opens, although `review` is `blocked` on `tests-full`

#### Scenario: a review round waits for execute

- **WHEN** part `02` is started and not done, and `bdk attempt open review-fix <change-id>` runs
- **THEN** the exit code is 2 with `rule: policy/not-ready` naming `execute-part:02`, and `instead` is `bdk explain execute-part:02`

#### Scenario: merge ticket starts the merge in the worktree

- **WHEN** `bdk part done 02` answered `policy/merge-conflict` naming `pnpm-lock.yaml`, and `bdk attempt open verify-fix 02 --json` runs
- **THEN** the output has `merge: true` and `conflicts: [pnpm-lock.yaml]`, the worktree of part 02 has a merge in progress with `pnpm-lock.yaml` unmerged, and `git status` of the home checkout is unchanged

#### Scenario: second ticket keeps the merge

- **WHEN** the first merge ticket of part 02 closed `fail` with the merge still in progress, and `bdk attempt open verify-fix 02` runs
- **THEN** no new `git merge` runs, and `conflicts` lists the paths still unmerged

### Requirement: bdk attempt close

Close a ticket with its outcome; check the diff, the evidence and the declared entries. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt close <ticket> ok|fail|not-run [--envelope <path>] [--reason <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket>` (required).
  - `ok|fail|not-run` (required). ok: done; fail: findings remain (fingerprints stored); not-run: the check could not be performed (P4).
  - `--envelope <path>`. The subagent's envelope file; its entry ids are checked.
  - `--reason <text>`. Required with not-run: which precondition was missing. Written as the record's body.
- **Behaviour:** Runs the diff check of `kernel-loops`, Diff check, for the ticket's target, over the working tree and, for a `part` or `verify-fix` ticket, the part's commits since the record's `base`: a forbidden path is a refusal and leaves the ticket open; undeclared files become one kernel `finding` entry and `diff.undeclared` in the output. With `--envelope`, the report's `entries` must all exist under the ticket (entries whose `ticket` is this ticket, written by `log add --ticket`; `log ingest` refuses such a report before it is stored); missing ids refuse with `policy/entries-missing` naming them. A `fail` stores the fingerprints of the ticket's `finding` and `blocker` entries (`kernel-loops`, Finding fingerprints and oscillation). `not-run` needs `--reason` (`input/missing-argument`) and advances the round's `not-run` counter without consuming the budget. The close stamps `closed-at` and `outcome` in place (`kernel-state`, Derived state and mutation). `next` is the orchestrator's instruction from `kernel-loops`, Escalation ladder: `commit`, `part-done`, `review-done`, `retry`, `narrow` with the next scope, `escalate`, or `parked`; for `parked` the kernel writes the ladder question (`question`, `park: true`, `review: true`, `source: kernel`, options, `refs` naming the target and the tickets of the round), runs the checkpoint, and `next` carries the entry id and the resume command. When the ticket's dispatch package names the role `implementer` and its attempt record has no `rules-read` (`kernel-cli/rules`, `rules show --ticket`), the close writes one kernel `finding` with `review: true`, summary `implementer closed <ticket> without reading its rules`, refs naming the target and the ticket, and returns its id as `rulesFinding`; the close itself goes on (risk R2). An `ok` close of a `part` ticket first requires every task of the part to carry a trailer commit (`kernel-loops`, Progress from git): an uncommitted task refuses with `policy/tasks-uncommitted` naming the tasks, `instead` naming `bdk check run <task> --ticket <ticket>` for the commit command and `git commit --amend --trailer` for a commit that lost its trailers. Evidence checks (P5, T4, T23-D41): an `ok` close of a `part` or `verify-fix` ticket, or of a `review-fix` round that holds a fix (an `implementer` package; its target is the Change), first records the `conform` manifest from the ticket's stored `conformer` report when one is stored (`source: kernel`, the report as its one committed file, the tree hash of the target, verdict `pass` for `status: done` or `done-with-concerns` and `not-run` for `blocked` or `needs-context`; no citation, as kernel evidence cites nothing), then checks every post-task step kind the pipeline applies, in pipeline order: the ticket's latest manifest of the kind must exist with verdict `pass` or `not-run` (`policy/missing-evidence` otherwise, naming the kind, with `instead` naming `attempt close <ticket> fail` for a `fail` verdict, the `conformer` package for a missing `conform` and `bdk check run <target> --ticket <ticket>` for a missing `tests-scoped` or `lint`), must be fresh against the current tree hash of the target (`policy/stale-evidence` naming the kind and the changed files), and, for `pass`, must carry at least one citation unless the kernel recorded it and still hold every `stored: committed` file with its recorded hash (`policy/missing-citation`). A `not-run` step verdict is accepted while the part of the target (every part for the Change) holds at most `policy.budgets.not-run` `not-run` manifests of that kind; past it the close is `policy/missing-evidence` with `instead` naming `attempt close <ticket> not-run --reason`. A `fail` or `not-run` close runs no evidence check, and any refusal leaves the ticket open. An `ok` or `fail` close of a `review-fix` ticket requires the round's merged report, stored by `log ingest --ticket <ticket>@merge` under `reports/<target>-orchestrator-<ticket>-merge.md` (`kernel-cli/review`; T42): without it the close refuses with `policy/missing-report`, and `instead` names the ingest of the merged report, `log add --type report` for it, and `attempt close <ticket> not-run --reason` for a round that could not run. A ticket that does not exist is `input/not-found`; a closed one is `policy/no-open-ticket`.

  An `ok` close of a merge ticket (T45) first refuses with `policy/merge-unresolved`, naming the paths, while git still reports an unmerged path in the worktree or a file the merge touched holds a conflict marker line (`<<<<<<< `, `=======` alone, `>>>>>>> `); then runs the evidence checks above on the merged state; then commits the merge in the worktree with the subject `chore(bdk): merge <Change branch> into part <part>` and the trailers `BDK-Change` and `BDK-Part`, a part merge commit (`kernel-loops`, Progress from git), and answers `next.action: part-done`; a git hook rejecting that commit refuses with `policy/git-hook-failed`. A `fail` close leaves the merge in progress for the next ticket of the round.

- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/evidence/`, `git:commit`
- **Output:** `schema/cli/output/attempt-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/do-not-touch`, `policy/entries-missing`, `policy/stale-evidence`, `policy/missing-citation`, `policy/missing-evidence`, `policy/missing-report`, `policy/tasks-uncommitted`, `policy/merge-unresolved`, `policy/git-hook-failed`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt close A-7f3k9m2q fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-implementer-A-7f3k9m2q.md --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "outcome": "fail",
    "diff": {
      "declared": [
        "src/auth/login.ts"
      ],
      "touched": [
        "src/auth/login.ts",
        "src/auth/util.ts"
      ],
      "undeclared": [
        "src/auth/util.ts"
      ]
    },
    "findings": [
      "L-e8k2s5vw"
    ],
    "fingerprints": [
      "sha256:3f1c9a0b7d2e4c6f8a1b3d5e7f9a0c2e4b6d8f0a1c3e5a7b9d1f3a5c7e9b1d3f"
    ],
    "notRunCount": 0,
    "next": {
      "action": "narrow",
      "scope": "blockers"
    }
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt close A-7f3k9m2q fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-implementer-A-7f3k9m2q.md --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-close.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket named is already closed
- **THEN** the exit code is 2 and the error object carries `rule: policy/no-open-ticket`

#### Scenario: policy/do-not-touch

- **WHEN** the real diff touches a `do-not-touch` path (P6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/do-not-touch`

#### Scenario: policy/entries-missing

- **WHEN** the envelope declares ledger ids that do not exist under this ticket
- **THEN** the exit code is 2 and the error object carries `rule: policy/entries-missing`

#### Scenario: policy/stale-evidence

- **WHEN** the evidence manifest is older than the last code change (P5)
- **THEN** the exit code is 2 and the error object carries `rule: policy/stale-evidence`

#### Scenario: policy/missing-citation

- **WHEN** an agent's PASS verdict cites no value that resolves inside the recorded evidence (T4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/missing-citation`

#### Scenario: policy/missing-evidence

- **WHEN** a `part` ticket closes `ok` and its latest `lint` manifest has verdict `fail`, or it has no `lint` manifest
- **THEN** the exit code is 2, the error object carries `rule: policy/missing-evidence` naming `lint`, and the ticket stays open

#### Scenario: policy/tasks-uncommitted

- **WHEN** tasks `02-1` and `02-2` of part `02` exist, only `02-1` has a trailer commit, and `bdk attempt close <part ticket> ok` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/tasks-uncommitted` naming `02-2`, and the ticket stays open

#### Scenario: stale step evidence refused

- **WHEN** `bdk check run 02 --ticket <ticket>` recorded `tests-scoped` and `lint` for part `02` and a file of the part changed before `bdk attempt close <ticket> ok`
- **THEN** the exit code is 2 with `rule: policy/stale-evidence` naming the kinds and the changed file

#### Scenario: fresh kernel evidence closes the ticket

- **WHEN** every task of part `02` has a trailer commit, the `part` ticket has a stored `conformer` report with `status: done`, `bdk check run 02 --ticket <ticket>` recorded fresh `tests-scoped` and `lint` manifests with `pass`, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, a `conform` manifest with `source: kernel` and verdict `pass` exists for the target, and `next.action` is `part-done`

#### Scenario: not-run within budget

- **WHEN** the `lint` manifest of a `part` ticket has verdict `not-run` and the part holds no other `not-run` `lint` manifest
- **THEN** `attempt close <ticket> ok` exits 0

#### Scenario: steps of a done part rerun under verify-fix

- **WHEN** a file of done part 01 changed after its steps were recorded, `bdk attempt open verify-fix 01` opened a ticket, the conformer's report is stored under it, `bdk check run 01` recorded fresh `tests-scoped` and `lint` manifests under it, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, the kernel recorded a `conform` manifest of target `01`, `next.action` is `part-done`, and `conform:01`, `tests-scoped:01` and `lint:01` are `done`

#### Scenario: committed undeclared path reported

- **WHEN** a commit with `BDK-Part: 02` made after the `base` of the open `part 02` ticket changes `src/auth/util.ts`, which no task declares, and the ticket closes `ok`
- **THEN** `diff.undeclared` lists `src/auth/util.ts` and one kernel `finding` names it

#### Scenario: a review round's fix needs its steps

- **WHEN** review round `A-r2v2w3x4` holds an `implementer` package whose fix changed `src/01-1.ts`, and `bdk attempt close A-r2v2w3x4 ok --json` runs with no `conform` manifest under it
- **THEN** the exit code is 2 with `rule: policy/missing-evidence` naming `conform`; once the conformer's report is stored and `bdk check run <change-id> --ticket A-r2v2w3x4` recorded fresh `tests-scoped` and `lint`, the close exits 0 and the step nodes of part `01` are `done`

#### Scenario: verifier ticket needs no step evidence

- **WHEN** a ticket holding only a `verifier` package closes `ok` with no manifest
- **THEN** the exit code is 0

#### Scenario: policy/missing-report

- **WHEN** a `review-fix` ticket has no report stored under `<ticket>@merge` and `bdk attempt close <ticket> fail --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/missing-report` naming the ticket, and the ticket stays open

#### Scenario: a merged review round closes to review-done

- **WHEN** the merged report of a `review-fix` ticket is stored and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0 and `next.action` is `review-done`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: fingerprints stored on fail

- **WHEN** a ticket closes `fail` with two `finding` entries under it, one referencing `src/auth/login.ts#verifyToken` and one referencing only `02-3`
- **THEN** the record's `findings` holds one item with `file: src/auth/login.ts`, `symbol: verifyToken` and its fingerprint

#### Scenario: implementer closed without reading rules

- **WHEN** an `implementer` ticket whose attempt record has no `rules-read` closes `ok`
- **THEN** the exit code is 0, the ticket is closed, and one kernel `finding` with `review: true` names the target and the ticket and its id is `rulesFinding`

#### Scenario: rules read before close

- **WHEN** the same ticket ran `bdk rules show --ticket` before closing
- **THEN** no rules finding is written and `rulesFinding` is absent

#### Scenario: policy/merge-unresolved

- **WHEN** the merge ticket of part 02 is closed `ok` while `pnpm-lock.yaml` still holds a `<<<<<<< ` line
- **THEN** the exit code is 2 with `rule: policy/merge-unresolved` naming `pnpm-lock.yaml`, the ticket stays open and no commit is created

#### Scenario: policy/git-hook-failed

- **WHEN** the merge ticket of part 02 is closed `ok` with the conflicts resolved, and a `commit-msg` hook of the project rejects the merge commit
- **THEN** the exit code is 2 with `rule: policy/git-hook-failed` and the hook's first line, the ticket stays open and the merge stays in progress in the worktree

#### Scenario: resolved merge commits

- **WHEN** the implementer regenerated `pnpm-lock.yaml`, `bdk check run 02` recorded `tests-scoped` and `lint` with verdict `pass` on the merged state, the conformer's report is stored, and the merge ticket is closed `ok`
- **THEN** the part branch's tip is a merge commit with the trailers `BDK-Change` and `BDK-Part: 02` whose second parent is the Change branch, `next.action` is `part-done`, and the next `bdk part done 02` exits 0

#### Scenario: fresh cited evidence closes the ticket

- **WHEN** a `verify-fix` ticket of done part `01` has a stored `conformer` report with `status: done` and fresh `tests-scoped` and `lint` manifests recorded by `bdk check run 01`, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, a `conform` manifest with `source: kernel` and verdict `pass` exists for the target, and `next.action` is `part-done`

### Requirement: bdk attempt list

Tickets and attempt records, open first. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt list [--for <task|part>] [--all]`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--for <task|part>`. Records whose target is the part, or the part holding the task.
  - `--all`. Every round, not only the current one of each loop and target.
- **Behaviour:** Reads the committed `attempts/` records, so it is correct on a fresh clone; the SQLite index only speeds it up. Open tickets first, then by `openedAt` newest first; at most 100 lines in text mode. `budgets` holds, for each loop with a record in scope, `used` and `of` of its current round, and `not-run` the round's consecutive `not-run` counter against `policy.budgets.not-run`; with `--for`, `entries` counts the ledger entries written under each listed ticket.
- **Writes:** nothing
- **Output:** `schema/cli/output/attempt-list.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt list --for 02 --json
  ```

  ```json
  {
    "items": [
      {
        "ticket": "A-7f3k9m2q",
        "loop": "part",
        "target": "02",
        "attempt": 2,
        "of": 3,
        "scope": "high+",
        "openedAt": "2026-09-25T10:02:11.482Z",
        "closedAt": "2026-09-25T10:19:40.917Z",
        "outcome": "fail",
        "entries": 2
      }
    ],
    "total": 1,
    "truncated": false,
    "for": "02",
    "budgets": {
      "part": {
        "used": 2,
        "of": 3
      },
      "not-run": {
        "used": 0,
        "of": 3
      }
    }
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt list --for 02 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/attempt-list.json`

#### Scenario: open tickets first

- **WHEN** the Change holds one open ticket and three closed records
- **THEN** the first item is the open ticket and has no `closedAt`

#### Scenario: a task selects its part

- **WHEN** part `02` holds task `02-3` and has two `part` records, and `bdk attempt list --for 02-3 --json` runs
- **THEN** `items` lists the two records of part `02`

### Requirement: bdk attempt show

One ticket's record: loop, target, state and steps. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk attempt show <ticket>`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<ticket>` (required). The ticket id, as `attempt open` and `attempt list` print it.
- **Behaviour:** Reads the committed `attempts/` record of the ticket, so it is correct on a fresh clone. The output is the item `attempt list` prints for the ticket (`loop`, `target`, `attempt`, `of`, `scope`, `openedAt`, `closedAt` and `outcome` once closed, `escalation`) with `entries`, the ledger entries written under the ticket, `base` for a `part` or `verify-fix` ticket, and, for the loops that change code (`part`, `verify-fix`, `review-fix`), the `steps` that `attempt open` returned. The state is `open` until the ticket has an `outcome`. A ticket the Change does not hold is `input/not-found` with `bdk attempt list` as `instead`. It changes nothing.
- **Writes:** nothing
- **Output:** `schema/cli/output/attempt-show.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt show A-7f3k9m2q --json
  ```

  ```json
  {
    "ticket": "A-7f3k9m2q",
    "loop": "part",
    "target": "02",
    "attempt": 2,
    "of": 3,
    "scope": "high+",
    "openedAt": "2026-09-25T10:02:11.482Z",
    "base": "4c1d2e3f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
    "steps": [
      {
        "kind": "conform",
        "role": "conformer"
      },
      {
        "kind": "tests-scoped",
        "command": "bdk check run"
      }
    ]
  }
  ```

- **Owner:** T22
- **Slice:** `attempt`

#### Scenario: example run

- **WHEN** `bdk attempt show A-7f3k9m2q --json` runs as in the example on an open `part` ticket
- **THEN** the exit code is 0, stdout validates against `schema/cli/output/attempt-show.json` and holds no `outcome`

#### Scenario: closed ticket

- **WHEN** it runs on a ticket closed `ok`
- **THEN** the output holds `outcome: ok` and `closedAt`

#### Scenario: input/not-found

- **WHEN** it runs on an id the Change does not hold
- **THEN** the exit code is 3, the error object carries `rule: input/not-found` and `instead` holds `bdk attempt list`
