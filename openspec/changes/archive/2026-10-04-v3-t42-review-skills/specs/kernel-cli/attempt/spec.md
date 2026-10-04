## MODIFIED Requirements

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
- **Behaviour:** Runs the diff check of `kernel-loops`, Diff check, for the ticket's target: a forbidden path is a refusal and leaves the ticket open; undeclared files become one kernel `finding` entry and `diff.undeclared` in the output. With `--envelope`, the report's `entries` must all exist under the ticket (entries whose `ticket` is this ticket, written by `log add --ticket`; `log ingest` refuses such a report before it is stored); missing ids refuse with `policy/entries-missing` naming them. A `fail` stores the fingerprints of the ticket's `finding` and `blocker` entries (`kernel-loops`, Finding fingerprints and oscillation). `not-run` needs `--reason` (`input/missing-argument`) and advances the round's `not-run` counter without consuming the budget. The close stamps `closed-at` and `outcome` in place (`kernel-state`, Derived state and mutation). `next` is the orchestrator's instruction from `kernel-loops`, Escalation ladder: `commit`, `part-done`, `review-done`, `retry`, `narrow` with the next scope, `escalate`, or `parked`; for `parked` the kernel writes the ladder question (`question`, `park: true`, `review: true`, `source: kernel`, options, `refs` naming the target and the tickets of the round), runs the checkpoint, and `next` carries the entry id and the resume command. When the ticket's dispatch package names the role `implementer` and its attempt record has no `rules-read` (`kernel-cli/rules`, `rules show --ticket`), the close writes one kernel `finding` with `review: true`, summary `implementer closed <ticket> without reading its rules`, refs naming the target and the ticket, and returns its id as `rulesFinding`; the close itself goes on (risk R2). Evidence checks (P5, T4, T23-D41): an `ok` close of a ticket that holds an `implementer` or a `simplifier` package (a code ticket; a `verify-fix` ticket that reruns the steps of a done part holds no `implementer` package) first records the `simplify` manifest from the ticket's stored `simplifier` report (`source: kernel`, the report as its one committed file, the tree hash of the target, verdict `pass` for `status: done` or `done-with-concerns` and `not-run` for `blocked` or `needs-context`; no citation, as kernel evidence cites nothing), then checks every post-task step kind the pipeline applies, in pipeline order: the ticket's latest manifest of the kind must exist with verdict `pass` or `not-run` (`policy/missing-evidence` otherwise, naming the kind, with `instead` naming `attempt close <ticket> fail` for a `fail` verdict and the step's role for a missing one), must be fresh against the current tree hash of the target (`policy/stale-evidence` naming the kind and the changed files), and, for `pass`, must carry at least one citation and still hold every `stored: committed` file with its recorded hash (`policy/missing-citation`). A `not-run` step verdict is accepted while the part of the target (every part for the Change) holds at most `policy.budgets.not-run` `not-run` manifests of that kind; past it the close is `policy/missing-evidence` with `instead` naming `attempt close <ticket> not-run --reason`. A `fail` or `not-run` close runs no evidence check, and any refusal leaves the ticket open. An `ok` or `fail` close of a `review-fix` ticket requires the round's merged report, stored by `log ingest --ticket <ticket>@merge` under `reports/<target>-orchestrator-<ticket>-merge.md` (`kernel-cli/review`; T42): without it the close refuses with `policy/missing-report`, and `instead` names the ingest of the merged report, `log add --type report` for it, and `attempt close <ticket> not-run --reason` for a round that could not run. A ticket that does not exist is `input/not-found`; a closed one is `policy/no-open-ticket`.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/evidence/`, `git:commit`
- **Output:** `schema/cli/output/attempt-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/do-not-touch`, `policy/entries-missing`, `policy/stale-evidence`, `policy/missing-citation`, `policy/missing-evidence`, `policy/missing-report`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk attempt close A-7f3k9m2q fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3k9m2q.md --json
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

- **WHEN** `bdk attempt close A-7f3k9m2q fail --envelope .bdk/changes/2026-09-25-passwordless-login/reports/02-3-implementer-A-7f3k9m2q.md --json` runs as in the example
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

- **WHEN** a PASS verdict cites no value that resolves inside the recorded evidence (T4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/missing-citation`

#### Scenario: policy/missing-evidence

- **WHEN** a code ticket closes `ok` and its latest `lint` manifest has verdict `fail`, or it has no `lint` manifest
- **THEN** the exit code is 2, the error object carries `rule: policy/missing-evidence` naming `lint`, and the ticket stays open

#### Scenario: stale step evidence refused

- **WHEN** the runner recorded `tests-scoped` and `lint` for `02-3` and a file of the part changed before `bdk attempt close <ticket> ok`
- **THEN** the exit code is 2 with `rule: policy/stale-evidence` naming the kinds and the changed file

#### Scenario: fresh cited evidence closes the ticket

- **WHEN** a code ticket has a stored `simplifier` report with `status: done` and fresh `tests-scoped` and `lint` manifests with `pass` and a resolving citation, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, a `simplify` manifest with `source: kernel` and verdict `pass` exists for the target, and `next.action` is `commit`

#### Scenario: not-run within budget

- **WHEN** the `lint` manifest of a code ticket has verdict `not-run` and the part holds no other `not-run` `lint` manifest
- **THEN** `attempt close <ticket> ok` exits 0

#### Scenario: steps of a done part rerun under verify-fix

- **WHEN** a file of done part 01 changed after its steps were recorded, `bdk attempt open verify-fix 01` opened a ticket, the simplifier's report is stored under it, the runner recorded fresh cited `tests-scoped` and `lint` manifests under it, and `bdk attempt close <ticket> ok --json` runs
- **THEN** the exit code is 0, the kernel recorded a `simplify` manifest of target `01`, and `simplify:01`, `tests-scoped:01` and `lint:01` are `done`

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
