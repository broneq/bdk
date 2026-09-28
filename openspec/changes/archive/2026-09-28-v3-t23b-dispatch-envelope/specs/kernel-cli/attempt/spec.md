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
- **Behaviour:** Runs the diff check of `kernel-loops`, Diff check, for the ticket's target: a forbidden path is a refusal and leaves the ticket open; undeclared files become one kernel `finding` entry and `diff.undeclared` in the output. With `--envelope`, the report's `entries` must all exist under the ticket (entries whose `ticket` is this ticket, written by `log add --ticket`; `log ingest` refuses such a report before it is stored); missing ids refuse with `policy/entries-missing` naming them. A `fail` stores the fingerprints of the ticket's `finding` and `blocker` entries (`kernel-loops`, Finding fingerprints and oscillation). `not-run` needs `--reason` (`input/missing-argument`) and advances the round's `not-run` counter without consuming the budget. The close stamps `closed-at` and `outcome` in place (`kernel-state`, Derived state and mutation). `next` is the orchestrator's instruction from `kernel-loops`, Escalation ladder: `post-task-steps`, `retry`, `narrow` with the next scope, `escalate`, or `parked`; for `parked` the kernel writes the ladder question (`question`, `park: true`, `review: true`, `source: kernel`, options, `refs` naming the target and the tickets of the round), runs the checkpoint, and `next` carries the entry id and the resume command. When the ticket's dispatch package names the role `implementer` and its attempt record has no `rules-read` (`kernel-cli/rules`, `rules show --ticket`), the close writes one kernel `finding` with `review: true`, summary `implementer closed <ticket> without reading its rules`, refs naming the target and the ticket, and returns its id as `rulesFinding`; the close itself goes on (risk R2). The evidence checks (`policy/stale-evidence`, P5; `policy/missing-citation`, T4) run from T23 part C. A ticket that does not exist is `input/not-found`; a closed one is `policy/no-open-ticket`.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `git:commit`
- **Output:** `schema/cli/output/attempt-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/do-not-touch`, `policy/entries-missing`, `policy/stale-evidence`, `policy/missing-citation`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

- **WHEN** the evidence manifest is older than the last code change (P5; emitted from T23)
- **THEN** the exit code is 2 and the error object carries `rule: policy/stale-evidence`

#### Scenario: policy/missing-citation

- **WHEN** a PASS verdict cites no value that resolves inside the recorded evidence (T4; emitted from T23)
- **THEN** the exit code is 2 and the error object carries `rule: policy/missing-citation`

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
