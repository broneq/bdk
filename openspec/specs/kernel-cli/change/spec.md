# kernel-cli/change Specification

## Purpose

Change lifecycle (`change`, `measure`). One Change per branch. `new` opens it, `status` and `list` read it, `resume` and `park` move it between active and parked, `takeover` recovers it from a dead session, `checkpoint` commits its directory, `close` ends it. `measure` sits here because `change new` is its first caller.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/change-exists",
  "why": "branch feat/login already has the active Change 2026-09-25-passwordless-login (stage design)",
  "instead": [
    "bdk change status",
    "bdk change close",
    "switch to a new branch and run change new there"
  ]
}
```

## Requirements

### Requirement: bdk change new

Open a Change on the current branch from an intent; measure and propose the profile. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change new <intent> [--kind feature|bug] [--profile tiny|small|large] [--inferred]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<intent>` (required). One sentence or a quoted paragraph; with --kind bug the reproduction.
  - `--kind feature|bug`. Graph variant; default feature (T02 decision R-8).
  - `--profile tiny|small|large`. Override the measured profile (R-profil).
  - `--inferred`. The Change is opened on the user's behalf by another skill; stamped source: inferred (R-12).
- **Behaviour:** Creates `.bdk/changes/<id>/` with `change.md` (written once, never mutated), runs `measure` on the intent, records the proposed profile as an `assumption` entry and the D4b list of locally overridden keys, and binds the Change to the current branch. `--profile` may only raise the measured profile. With `--inferred` the intent is the first sentence of the caller's context and `change status` shows the Change as unconfirmed until the user runs a stage command. Refuses when the branch already has an active Change.
- **Writes:** `.bdk/changes/<id>/change.md`, `.bdk/changes/<id>/log/`, `.bdk/.machine/`
- **Output:** `schema/cli/output/change-new.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/change-exists`, `policy/profile-downgrade`, `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change new "Add passwordless login" --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "branch": "feat/login",
    "kind": "feature",
    "profile": {
      "value": "small",
      "measured": "small",
      "overridden": false,
      "entry": "L-m2x9v"
    },
    "source": "user",
    "overriddenKeys": [
      "policy.escalation.enabled"
    ],
    "next": "design"
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change new "Add passwordless login" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-new.json`

#### Scenario: policy/change-exists

- **WHEN** the branch already has an active Change
- **THEN** the exit code is 2 and the error object carries `rule: policy/change-exists`

#### Scenario: policy/profile-downgrade

- **WHEN** the requested profile is smaller than the current one (R-profil)
- **THEN** the exit code is 2 and the error object carries `rule: policy/profile-downgrade`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

### Requirement: bdk change status

The active Change at a glance: stage, graph state, gate status with pending review entries, parked options. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change status`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Read-only, at most 100 lines in text mode. Shows which gates were passed by the user and which by policy (`passedBy`), an inferred intent as unconfirmed, and, when parked, the options and the single resume command. This is the second place (after the previous stage skill's closing output) where the user sees pending `review: true` entries before typing the next stage command.
- **Writes:** nothing
- **Output:** `schema/cli/output/change-status.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change status --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "kind": "feature",
    "profile": "small",
    "source": "user",
    "confirmed": true,
    "stage": "design",
    "nodes": [
      {
        "id": "design",
        "kind": "design",
        "state": "done"
      },
      {
        "id": "gate:design",
        "kind": "gate",
        "state": "ready"
      }
    ],
    "gates": [
      {
        "gate": "gate:design",
        "ready": true,
        "done": false,
        "command": "/bdk:plan",
        "pending": [
          {
            "id": "L-k3d8p",
            "type": "question",
            "summary": "Keep magic links or add WebAuthn?",
            "status": "proposed",
            "source": "agent:design-verifier",
            "at": "2026-09-25T09:41:07Z",
            "refs": [
              "design.md"
            ],
            "review": true
          }
        ]
      }
    ],
    "parts": []
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change status --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-status.json`

### Requirement: bdk change list

List Changes in this repository: active per branch, parked, archived. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change list [--all]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--all`. Include archived Changes.
- **Behaviour:** Without `--all` archived Changes are omitted. Different Changes on different branches own different directories, so the list is the union of committed Change directories and local branch markers.
- **Writes:** nothing
- **Output:** `schema/cli/output/change-list.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: none; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change list --json
  ```

  ```json
  {
    "items": [
      {
        "change": "2026-09-25-passwordless-login",
        "branch": "feat/login",
        "stage": "design",
        "state": "active",
        "kind": "feature",
        "profile": "small",
        "updatedAt": "2026-09-25T09:41:07Z"
      }
    ],
    "total": 1,
    "truncated": false
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change list --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-list.json`

### Requirement: bdk change resume

Bind an existing Change to the current branch or leave the parked state with a chosen option. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change resume <id> [--option <n>] [--profile small|large]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<id>` (required).
  - `--option <n>`. Index of the option from the parked entry; required when the Change is parked.
  - `--profile small|large`. Raise the profile mid-flight; never lowers it.
- **Behaviour:** On a parked Change the chosen option is written as a `decision` entry (`source: user` is not used: the resume is a kernel action on the user's typed command, so the entry carries `source: kernel` and `refs` to the parked `question`). On another machine or a fresh clone it rebinds the branch marker without writing an entry (S5).
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/.machine/`
- **Output:** `schema/cli/output/change-resume.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`, `policy/change-exists`, `policy/profile-downgrade`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change resume 2026-09-25-passwordless-login --option 2 --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "branch": "feat/login",
    "stage": "execute",
    "resumedFrom": "parked",
    "decision": "L-p9q2r",
    "next": "execute-part:02"
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change resume 2026-09-25-passwordless-login --option 2 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-resume.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/change-exists

- **WHEN** the branch already has an active Change
- **THEN** the exit code is 2 and the error object carries `rule: policy/change-exists`

#### Scenario: policy/profile-downgrade

- **WHEN** the requested profile is smaller than the current one (R-profil)
- **THEN** the exit code is 2 and the error object carries `rule: policy/profile-downgrade`

### Requirement: bdk change park

Park the active Change with a question or blocker entry, options and one resume command. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change park [--reason <text>] [--option <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--reason <text>`. Becomes the summary of the question entry.
  - `--option <text>`. Repeatable; at least one. Defaults are accept as debt, change decision X, split part.
- **Behaviour:** Called by the orchestrator when the escalation ladder ends (A-drabina) or by the user through `/bdk:change park`. Writes the `question` entry with the options, then runs `change checkpoint` (V-checkpoint). Refuses while a ticket is open: close or `attempt close not-run` first.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/attempts/`
- **Output:** `schema/cli/output/change-park.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change park --reason "02-3 exhausted its budget" --option "accept as debt" --option "split part 02" --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "entry": "L-t4w7n",
    "options": [
      "accept as debt",
      "split part 02"
    ],
    "resume": "bdk change resume 2026-09-25-passwordless-login --option <n>",
    "checkpoint": {
      "done": true,
      "commit": "a1b2c3d"
    }
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change park --reason "02-3 exhausted its budget" --option "accept as debt" --option "split part 02" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-park.json`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

### Requirement: bdk change takeover

Take over a Change whose previous session died with open tickets. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change takeover [--close-tickets]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--close-tickets`. Close every open ticket as not-run instead of refusing.
- **Behaviour:** Today's `--force`. Records the takeover as a `transition` entry, closes the dead session's tickets as `not-run` when asked (their `not-run` counters advance, budgets stay), and runs `rebuild`. Refuses when the recorded session is still alive on this machine.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/.machine/`
- **Output:** `schema/cli/output/change-takeover.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change takeover --close-tickets --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "previousSession": "<SESSION-3>",
    "closedTickets": [
      "A-7f3k"
    ],
    "rebuilt": true
  }
  ```

- **Owner:** T22
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change takeover --close-tickets --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-takeover.json`

#### Scenario: policy/invalid-transition

- **WHEN** the Change or part is not in a state from which the verb applies
- **THEN** the exit code is 2 and the error object carries `rule: policy/invalid-transition`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

### Requirement: bdk change checkpoint

Pathspec commit of the Change directory: `chore(bdk): checkpoint <change>`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change checkpoint`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Runs `git commit --only -- .bdk/changes/<id>/`, so files the user staged are never swept in (V1-4). Exits 0 with `skipped` when nothing changed or `policy.checkpoint.enabled` is false; refuses during a rebase, merge or cherry-pick and while a ticket is open (subagents may still be writing). Called by `hooks session-end`, `change park` and the escalation step.
- **Writes:** `git:commit`
- **Output:** `schema/cli/output/change-checkpoint.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/git-in-progress`, `policy/ticket-open`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change checkpoint --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "done": true,
    "commit": "a1b2c3d"
  }
  ```

- **Owner:** T22
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change checkpoint --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-checkpoint.json`

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress (V1-4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-in-progress`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

### Requirement: bdk change close

Close the Change after the review gate: spec merge, learning routing, archive, PR summary. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change close [--squash] [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--squash`. Squash checkpoint commits (policy default open, V2-2).
  - `--dry-run`. Report what would be merged, routed and archived; write nothing.
- **Behaviour:** Requires the final review gate to be done (a `source: user` or `source: policy` transition). Runs `spec merge` (refusing on conflict or a merge-hash mismatch, so a manual spec edit is caught here at the latest), routes `learning` entries, prunes `dispatch/` and `reports/` to hash indexes unless `archive.keep-evidence`, regenerates `.claude/rules/bdk-generated.md` and prints the PR summary. `--dry-run` is the form `/bdk:close` runs first to show the user what will happen.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/archive/<date>-<id>/`, `.bdk/specs/`, `.claude/rules/bdk-generated.md`, `git:commit`
- **Output:** `schema/cli/output/change-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/gate-not-ready`, `policy/ticket-open`, `policy/spec-conflict`, `policy/merge-hash-mismatch`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change close --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "archivedTo": ".bdk/changes/archive/2026-09-26-2026-09-25-passwordless-login",
    "spec": {
      "merged": [
        "auth/login"
      ]
    },
    "learning": {
      "proposedRules": [
        "L-z1c4h"
      ],
      "spec": [],
      "nothing": [
        "L-q8n2m"
      ]
    },
    "gatesByPolicy": [],
    "summary": "## Passwordless login\n..."
  }
  ```

- **Owner:** T30
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change close --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-close.json`

#### Scenario: policy/gate-not-ready

- **WHEN** the gate node is not ready
- **THEN** the exit code is 2 and the error object carries `rule: policy/gate-not-ready`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: policy/spec-conflict

- **WHEN** two deltas edit the same requirement differently
- **THEN** the exit code is 2 and the error object carries `rule: policy/spec-conflict`

#### Scenario: policy/merge-hash-mismatch

- **WHEN** a spec file's content hash differs from its `bdk-merge-hash` (V1-7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/merge-hash-mismatch`

#### Scenario: state/trailer-mismatch

- **WHEN** progress derived from git trailers disagrees with the committed attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

### Requirement: bdk measure

Measure the size of an intent or a diff: files, impacted modules, proposed profile. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk measure [<intent>] [--diff <ref>]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<intent>` (optional). Text to measure; omit with --diff.
  - `--diff <ref>`. Measure a git diff (base ref) instead of an intent; what cr uses for agent scaling.
- **Behaviour:** Deterministic for the same input (T20 acceptance). Shared by `change new` (profile) and `/bdk:cr` (agent count, T02 decision R-4). The heuristic and thresholds are T20's to calibrate; the output fields are fixed here.
- **Writes:** nothing
- **Output:** `schema/cli/output/measure.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk measure "Add passwordless login" --json
  ```

  ```json
  {
    "profile": "small",
    "files": 6,
    "modules": [
      "auth",
      "mail"
    ],
    "impact": 14,
    "signals": {
      "files": 6,
      "modules": 2,
      "impact": 14
    }
  }
  ```

- **Owner:** T20
- **Slice:** `measure`

#### Scenario: example run

- **WHEN** `bdk measure "Add passwordless login" --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/measure.json`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`
