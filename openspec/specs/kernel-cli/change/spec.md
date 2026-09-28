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

Open a Change on the current branch from an intent and record its starting profile. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change new <intent> [--kind feature|bug] [--profile tiny|small|large] [--reason <text>] [--inferred]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<intent>` (required). One sentence or a quoted paragraph; with --kind bug the reproduction.
  - `--kind feature|bug`. Graph variant; default feature (T02 decision R-8).
  - `--profile tiny|small|large`. Starting profile, judged by the calling skill; default small (R-profil).
  - `--reason <text>`. Why this profile; written into the body of the profile assumption entry. Required with --profile tiny.
  - `--inferred`. The Change is opened on the user's behalf by another skill; stamped source: inferred (R-12).
- **Behaviour:** Creates `.bdk/changes/<id>/` with `change.md` (written once, never mutated), records the starting profile as an `assumption` entry (`source: kernel`, `refs: [change.md]`, `--reason` as its body) and the D4b list of locally overridden keys (`overridden` in `change.md`, names only, from the resolved configuration), and binds the Change to the current branch (`kernel-state`, Branch binding). The kernel does not measure the intent: one sentence carries too little to size a Change, and each size decision is taken where its information exists. Whether the Change is trivial enough to skip design (`tiny`, S7) is judged by the calling skill before the Change exists; `small` is the default, because an undersized Change skips design and plan verification while an oversized one costs one short step. `--profile tiny` without `--reason` is `input/missing-argument`, so every skipped design carries its justification in the ledger. `large` at start is for a user who already knows the Change spans several subsystems; otherwise the profile is raised later by a `decision` entry carrying `profile` (`kernel-state`, Derived state and mutation). The Change id is the kernel clock's UTC date plus a kebab-case slug of the intent's first words, at most 40 characters, `change` when the intent yields no slug character. With `--inferred` the intent is the first sentence of the caller's context and `change status` shows the Change as unconfirmed until the user runs a stage command. Refuses when the branch already has an active Change that is not archived, and when the Change directory for the computed id exists (`policy/change-exists` naming the directory, `instead` suggesting a more specific intent); refuses on a detached `HEAD`, because a Change binds to a branch. Before writing, the project `.gitignore` is completed through the ignored-paths rule (`kernel-state`, Ignored paths). `next` is the stage command of the first actionable node of the new Change's graph (`kernel-pipeline`, Graph variants): `/bdk:design` for a `small` or `large` feature, `/bdk:plan` for `tiny` and for `bug`. When the graph cannot be read (the settings hold a key the graph refuses), the Change is still opened and `next` is left out; `bdk next` then answers the refusal.
- **Writes:** `.bdk/changes/<id>/change.md`, `.bdk/changes/<id>/log/`, `.bdk/.machine/`, `.gitignore`
- **Output:** `schema/cli/output/change-new.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `policy/change-exists`, `policy/detached-head`, `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change new "Add passwordless login" --json
  ```

  ```json
  {
    "change": "2026-09-25-add-passwordless-login",
    "branch": "feat/login",
    "kind": "feature",
    "profile": {
      "value": "small",
      "defaulted": true,
      "entry": "L-m2x9v7qa"
    },
    "source": "user",
    "overriddenKeys": [
      "policy.escalation.enabled"
    ],
    "next": "/bdk:design"
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

- **WHEN** `bdk change new "<intent>" --profile tiny --reason "<why>"` runs, a profile below the `small` default
- **THEN** the exit code is 0: `change new` sets the starting profile and never refuses `policy/profile-downgrade`, which only `change resume` emits

#### Scenario: policy/detached-head

- **WHEN** `HEAD` is detached, so there is no branch to bind the Change to
- **THEN** the exit code is 2, the error object carries `rule: policy/detached-head` and no file is written

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: default profile recorded as an assumption

- **WHEN** `bdk change new "<intent>"` runs without `--profile`
- **THEN** `change.md` carries `profile: small`, `profile.defaulted` is `true` and the ledger holds one `assumption` entry with `source: kernel` naming the profile, whose id is `profile.entry` of the output

#### Scenario: tiny needs a reason

- **WHEN** `bdk change new "Fix typo in README" --profile tiny` runs without `--reason`
- **THEN** the exit code is 3 with `rule: input/missing-argument` and no file is written

#### Scenario: tiny with a reason

- **WHEN** `bdk change new "Fix typo in README" --profile tiny --reason "one word in one doc file, no behaviour change"` runs
- **THEN** `change.md` carries `profile: tiny`, `profile.defaulted` is `false` and the assumption entry's body is the reason

#### Scenario: next after change new

- **WHEN** `bdk change new "Add passwordless login" --json` runs, and separately `bdk change new "Login fails after reset" --kind bug --json` on another branch
- **THEN** the first output has `next: /bdk:design` and the second `next: /bdk:plan`

### Requirement: bdk change status

The active Change at a glance: stage, graph state, gate status with pending review entries, parked options. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change status`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Read-only, at most 100 lines in text mode. Shows which gates were passed by the user and which by policy (`passedBy`), an inferred intent as unconfirmed (`confirmed: false` while `change.md` carries `source: inferred` and the ledger holds no `transition` with `source: user`), the effective profile and stage derived from the ledger (`kernel-state`, Derived state and mutation), and, when parked, the options and the single resume command. This is the second place (after the previous stage skill's closing output) where the user sees pending `review: true` entries before typing the next stage command. `nodes` lists every node of the Change's graph in pipeline order with instances expanded, skipped nodes included, each with its state, requirements, recorded input hash and `why` (`kernel-pipeline`, Node states); `gates` lists every gate with `ready`, `done`, `passedBy`, `command` and the pending `review: true` entries (T21). In text mode the node list collapses done instances of one collection into one line so the 100-line limit holds. `parts` lists every plan part as `part list` does (`kernel-cli/part`, bdk part list), and is empty while the Change has no plan parts.
- **Writes:** nothing
- **Output:** `schema/cli/output/change-status.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: none; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change status --json
  ```

  ```json
  {
    "change": "2026-09-25-add-passwordless-login",
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
            "id": "L-k3d8p2wz",
            "type": "question",
            "summary": "Keep magic links or add WebAuthn?",
            "status": "proposed",
            "source": "agent:design-verifier",
            "at": "2026-09-25T09:41:07.123Z",
            "refs": [
              "design.md"
            ],
            "review": true
          }
        ]
      }
    ],
    "parts": [
      {
        "part": "01",
        "title": "Token service",
        "state": "ready",
        "tasks": 4,
        "done": 0,
        "bytes": 5120,
        "specImpact": "none",
        "wave": 1
      }
    ]
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change status --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/change-status.json`

#### Scenario: inferred intent is unconfirmed

- **WHEN** the active Change was opened with `change new --inferred` and the ledger holds no `transition` with `source: user`
- **THEN** `change status --json` answers `source: inferred` and `confirmed: false`, and the text form marks the intent as unconfirmed

#### Scenario: at most 100 lines

- **WHEN** `change status` runs in text mode on a Change with 1 000 ledger entries, a parked question with options and pending review entries
- **THEN** the output has at most 100 lines

#### Scenario: graph in the status

- **WHEN** a `small` feature Change has `design` done and `gate:design` not passed
- **THEN** `change status --json` lists `intent` and `design` as `done`, `gate:design` as `ready`, `plan` as `blocked`, and `gates` holds `gate:design` with `command: /bdk:plan` and `gate:review` with `ready: false`

#### Scenario: gate passed by policy

- **WHEN** `policy.gates.design` is `auto` and a `source: policy` transition passed `gate:design`
- **THEN** the `gates` entry of `gate:design` has `passedBy: policy`, and the text form says the gate was passed by policy

#### Scenario: parts in the status

- **WHEN** a Change has plan parts `01` (done) and `02` (started, one of three tasks committed)
- **THEN** `change status --json` lists both in `parts` with the same `state`, `tasks` and `done` values as `part list --json`

### Requirement: bdk change list

List Changes in this repository: active per branch, parked, archived. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change list [--all]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `--all`. Include archived Changes.
- **Behaviour:** Without `--all` archived Changes are omitted. Different Changes on different branches own different directories, so the list is the union of committed Change directories and local branch markers: `branch` names the local branch bound to the Change and is absent when no marker binds it (a fresh clone before `change resume`). `state` is `archived` under `.bdk/changes/archive/`, `parked` while the derived parked state holds, `active` otherwise. `updatedAt` is the latest `at` of the Change's entries, or of `change.md` without entries. Sorted by `updatedAt`, newest first.
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
        "change": "2026-09-25-add-passwordless-login",
        "branch": "feat/login",
        "stage": "design",
        "state": "active",
        "kind": "feature",
        "profile": "small",
        "updatedAt": "2026-09-25T09:41:07.123Z"
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

#### Scenario: Change without a local marker

- **WHEN** a committed Change directory exists and no local branch marker names it
- **THEN** `change list --json` lists it without `branch` and with `state: active` unless it is parked

### Requirement: bdk change resume

Bind an existing Change to the current branch or leave the parked state with a chosen option. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change resume <id> [--option <n>] [--profile small|large]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<id>` (required).
  - `--option <n>`. Index of the option from the parked entry; required when the Change is parked.
  - `--profile small|large`. Raise the profile mid-flight; never lowers it.
- **Behaviour:** On a parked Change the chosen option (1-based) is written as a `decision` entry whose summary is the option and whose `refs` name the parked `question` (`source: user` is not used: the resume is a kernel action on the user's typed command, so the entry carries `source: kernel`). `--option` on a Change that is not parked, or a parked Change without `--option`, is `policy/invalid-transition`; an index outside the options is `input/invalid-argument`. On another machine or a fresh clone, or when the Change is bound to another local branch, it rebinds the branch marker without writing an entry (S5); `resumedFrom` says which (`other-branch` when another local marker named it, `other-machine` when none did). `--profile` above the effective profile writes a `decision` entry carrying `profile`; the same profile writes nothing; a lower one is `policy/profile-downgrade`. A Change already bound to the current branch, not parked and without `--profile` is `policy/invalid-transition`; so is an archived Change. Refuses when the current branch is bound to another live Change (`policy/change-exists`) and on a detached `HEAD`. `next` is the stage command of the stage of the node `bdk next` returns after the resume, or of the gate the Change waits for; when the graph cannot be read (the settings hold a key the graph refuses), the resume still happens and `next` is left out, so `bdk next` answers the refusal.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/.machine/`
- **Output:** `schema/cli/output/change-resume.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/invalid-transition`, `policy/change-exists`, `policy/profile-downgrade`, `policy/detached-head`, `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change resume 2026-09-25-add-passwordless-login --option 2 --json
  ```

  ```json
  {
    "change": "2026-09-25-add-passwordless-login",
    "branch": "feat/login",
    "stage": "execute",
    "resumedFrom": "parked",
    "decision": "L-p9q2r4tx",
    "next": "/bdk:execute"
  }
  ```

- **Owner:** T20
- **Slice:** `change`

#### Scenario: example run

- **WHEN** `bdk change resume 2026-09-25-add-passwordless-login --option 2 --json` runs as in the example
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

#### Scenario: policy/detached-head

- **WHEN** `HEAD` is detached
- **THEN** the exit code is 2 and the error object carries `rule: policy/detached-head`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH` and the resume writes an entry
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: fresh clone rebinds

- **WHEN** a committed Change has no local branch marker and `change resume <id>` runs on a branch without an active Change
- **THEN** the exit code is 0, `resumedFrom` is `other-machine`, no ledger entry is written and `change status` on that branch answers for the Change

### Requirement: bdk change park

Park the active Change with a question or blocker entry, options and one resume command. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change park [--reason <text>] [--option <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--reason <text>`. Becomes the summary of the question entry.
  - `--option <text>`. Repeatable; at least one. Defaults are accept as debt, change decision X, split part.
- **Behaviour:** Called by the orchestrator when the escalation ladder ends (A-drabina) or by the user through `/bdk:change park`. Writes the `question` entry with `park: true`, the options and `source: kernel` (summary from `--reason`, default `Change parked: choose how to continue`, at most 120 characters), then runs the checkpoint (`kernel-loops`, Checkpoint; V-checkpoint) and reports it in `checkpoint`: `{done: true, commit}`, or `{done: false, skipped: <reason>}` when it was skipped (disabled by policy, nothing changed, a rebase, merge or cherry-pick in progress, or a failing git hook); a skipped checkpoint never fails the park. The ladder's end in `attempt close` writes the same kind of `question` itself (`kernel-loops`, Escalation ladder), so `change park` is for a user or orchestrator decision outside a loop. Refuses while a ticket is open (an attempt record without `outcome`): close or `attempt close not-run` first. Refuses a Change that is already parked with `policy/invalid-transition`.
- **Writes:** `.bdk/changes/<id>/log/`, `git:commit`
- **Output:** `schema/cli/output/change-park.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change park --reason "02-3 exhausted its budget" --option "accept as debt" --option "split part 02" --json
  ```

  ```json
  {
    "change": "2026-09-25-add-passwordless-login",
    "entry": "L-t4w7n3kd",
    "options": [
      "accept as debt",
      "split part 02"
    ],
    "resume": "bdk change resume 2026-09-25-add-passwordless-login --option <n>",
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

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: park commits the Change directory

- **WHEN** `policy.checkpoint.enabled` is true, no ticket is open, and `bdk change park --reason "waiting for API keys" --json` runs
- **THEN** `checkpoint.done` is true, `checkpoint.commit` is the new `HEAD`, and that commit contains the park question under `.bdk/changes/<id>/log/`

### Requirement: bdk change takeover

Take over a Change whose previous session died with open tickets. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change takeover [--close-tickets]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--close-tickets`. Close every open ticket as not-run instead of refusing.
- **Behaviour:** Today's `--force`. Without an open ticket there is nothing to take over: `policy/invalid-transition` with `instead` naming `bdk rebuild`. Without `--close-tickets` it refuses with `policy/ticket-open` listing the open tickets. With it, each open ticket is closed as `not-run` with the body `taken over` (its round's `not-run` counter advances, budgets stay; `kernel-loops`, Not-run outcome), a kernel `transition` entry to the Change's current stage records the takeover with the closed tickets in `refs`, and the rebuild of `bdk rebuild` runs for the Change. The kernel cannot yet tell whether the session that opened a ticket is alive, because session ids reach it only through T24's hooks; until then `previousSession` is absent and the orchestrator runs takeover only after the user confirmed the previous session is gone.
- **Writes:** `.bdk/changes/<id>/attempts/`, `.bdk/changes/<id>/log/`, `.bdk/changes/<id>/`, `.bdk/.machine/`, `.bdk/rules/`
- **Output:** `schema/cli/output/change-takeover.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/invalid-transition`, `policy/ticket-open`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change takeover --close-tickets --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "closedTickets": [
      "A-7f3k9m2q"
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

- **WHEN** the Change has no open ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/invalid-transition` and `instead` names `bdk rebuild`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is open and `--close-tickets` is not given
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open` listing the ticket

#### Scenario: state/trailer-mismatch

- **WHEN** the rebuild finds trailers that disagree with the plan or the attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: taken-over ticket keeps the budget

- **WHEN** ticket `A-7f3k9m2q` of `task-redispatch 02-3` is open after one failed attempt and `bdk change takeover --close-tickets` runs
- **THEN** the ticket's record has `outcome: not-run` and body `taken over`, `attempt list --for 02-3` shows `budgets.task-redispatch.used: 1` and `budgets.not-run.used: 1`, and a new `attempt open task-redispatch 02-3` exits 0

### Requirement: bdk change checkpoint

Pathspec commit of the Change directory: `chore(bdk): checkpoint <change>`. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change checkpoint`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Stages `.bdk/changes/<id>/` and commits only that path with a pathspec commit, subject `chore(bdk): checkpoint <id>`, so files the user staged are never swept in (V1-4; `kernel-loops`, Checkpoint). Exits 0 with `done: false` and `skipped` naming the reason when `policy.checkpoint.enabled` is false or nothing under the Change directory changed. Refuses during a rebase, merge or cherry-pick (`policy/git-in-progress`), while a ticket is open (`policy/ticket-open`: subagents may still be writing) and when a git hook fails (`policy/git-hook-failed`, no commit created). `change park`, `attempt open --escalate` and the end of the ladder in `attempt close` run the same checkpoint and report those three cases as `skipped` instead of refusing; `hooks session-end` calls it from T24.
- **Writes:** `git:commit`
- **Output:** `schema/cli/output/change-checkpoint.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/git-in-progress`, `policy/git-hook-failed`, `policy/ticket-open`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: policy/git-hook-failed

- **WHEN** the repository's `commit-msg` hook rejects the message
- **THEN** the exit code is 2, the error object carries `rule: policy/git-hook-failed` and `HEAD` is unchanged

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: nothing to checkpoint

- **WHEN** the Change directory has no change since the last commit
- **THEN** the exit code is 0, `done` is false, `skipped` says nothing changed and `HEAD` is unchanged

#### Scenario: user's staged files stay out

- **WHEN** the user staged `src/app.ts` and `bdk change checkpoint` creates a commit
- **THEN** the commit's paths are all under `.bdk/changes/<id>/` and `src/app.ts` is still staged

### Requirement: bdk change close

Close the Change after the review gate: spec merge, learning routing, archive, PR summary. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change close [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--dry-run`. Report what would be merged, routed and archived; write nothing.
- **Behaviour:** The checks run in this order, the first failing one refusing, and nothing is written before all pass: the `close` node is ready, that is `gate:review` is done through a `source: user` or `source: policy` transition (`policy/gate-not-ready`); no ticket of the Change is open (`policy/ticket-open`); progress from git trailers agrees with the attempt records (`state/trailer-mismatch`, `kernel-loops`, Progress from git); no rebase, merge or cherry-pick is in progress (`policy/git-in-progress`); then `spec merge`'s checks in its order (`policy/merge-hash-mismatch`, `policy/spec-conflict`, `policy/spec-invalid`), so a manual spec edit is caught here at the latest. Then, unless `--dry-run`: the merge writes `.bdk/specs/`; the `close` transition entry is written (`source: kernel`); `dispatch/` and `reports/` are pruned to their hash indexes unless `archive.keep-evidence` (`kernel-state`, Pruned index); the Change directory moves to `.bdk/changes/archive/<id>/` (the id already starts with its creation date); the branch marker of the Change is removed, so the branch has no active Change; one pathspec commit, subject `chore(bdk): close <id>` with the trailer `BDK-Change: <id>`, stages `.bdk/specs/`, `.bdk/changes/<id>/` and `.bdk/changes/archive/<id>/` only, so files the user staged are never swept in. A git hook rejecting that commit is `policy/git-hook-failed`; the archive stays in the work tree for the user to commit. The output's `summary` is the PR summary in Markdown, built from the ledger alone: the intent from `change.md`, the live `decision`, `assumption` and `risk` entries, the live `finding` and `blocker` entries as open findings, and the merged capabilities. `gatesByPolicy` lists the gates passed by a `source: policy` transition. `spec.unchanged` is true when the Change has no delta. The `learning` lists stay empty until T31 lands `log route` and the rule projection (`.claude/rules/bdk-generated.md`); T31 fills them at close. `--dry-run` is the form `/bdk:close` runs first to show the user what will happen: the same checks and the same output, with `archivedTo` naming the target path, and nothing written. `--squash` is not part of contract version 3 (user decision, 2026-09-28): a squash merge of the PR folds the checkpoint commits without rewriting the commits that trailers and attempt records name.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/archive/<id>/`, `.bdk/specs/`, `.claude/rules/bdk-generated.md`, `git:commit`
- **Output:** `schema/cli/output/change-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/gate-not-ready`, `policy/ticket-open`, `policy/spec-conflict`, `policy/spec-invalid`, `policy/merge-hash-mismatch`, `policy/git-in-progress`, `policy/git-hook-failed`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk change close --json
  ```

  ```json
  {
    "change": "2026-09-25-passwordless-login",
    "archivedTo": ".bdk/changes/archive/2026-09-25-passwordless-login",
    "spec": {
      "merged": [
        "auth/login"
      ]
    },
    "learning": {
      "proposedRules": [],
      "spec": [],
      "nothing": []
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

#### Scenario: policy/spec-invalid

- **WHEN** a delta breaks the format
- **THEN** the exit code is 2 and the error object carries `rule: policy/spec-invalid`

#### Scenario: policy/merge-hash-mismatch

- **WHEN** a spec file's content hash differs from its `bdk-merge-hash` (V1-7)
- **THEN** the exit code is 2 and the error object carries `rule: policy/merge-hash-mismatch`

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-in-progress`

#### Scenario: policy/git-hook-failed

- **WHEN** a git hook of the repository rejects the close commit
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-hook-failed`

#### Scenario: state/trailer-mismatch

- **WHEN** progress derived from git trailers disagrees with the committed attempt records
- **THEN** the exit code is 4 and the error object carries `rule: state/trailer-mismatch`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: close archives, prunes and commits

- **WHEN** `gate:review` is done, `archive.keep-evidence` is unset and `bdk change close --json` runs
- **THEN** the exit code is 0, `.bdk/changes/<id>/` is gone, `.bdk/changes/archive/<id>/` holds the Change with `dispatch/pruned.md` and `reports/pruned.md`, `.bdk/specs/` holds the merged specs, `HEAD` is `chore(bdk): close <id>` touching only those paths, and a Change-scoped command on the branch answers `policy/no-active-change`

#### Scenario: keep evidence

- **WHEN** `.bdk/settings.yaml` sets `archive.keep-evidence: true` and the Change closes
- **THEN** the archived `dispatch/` and `reports/` keep their files and hold no `pruned.md`

#### Scenario: dry run writes nothing

- **WHEN** `bdk change close --dry-run --json` runs on a Change ready to close
- **THEN** the exit code is 0, the output names the capabilities it would merge and the archive path, and `git status --porcelain` is unchanged

### Requirement: bdk measure

Measure a git diff: changed files, lines and modules, as raw signals for the caller's own classification. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk measure [<range>]`
- **Availability:** `read`
- **Mode:** `command`
- **Arguments:**
  - `<range>` (optional). `<base>` measures the working tree (staged and unstaged tracked changes) against base; `<base>..<head>` measures committed history only. Default HEAD.
- **Behaviour:** Deterministic for the same range and the same repository state (T20 acceptance). Reads `git diff --numstat` for the range (`git diff --numstat <base>` or `git diff --numstat <base>..<head>`), so untracked files are not counted. `files` is the number of changed files, `added` and `removed` the summed line counts, `lines` their sum (a binary file counts as a file with zero lines), `modules` the distinct first two directory segments of the changed files (the file name alone for a root file), sorted. Paths under `.bdk/` are excluded, so ledger entries never inflate the size. The command returns signals only, never a profile or a class: each consumer applies its own thresholds (`/bdk:cr` its agent-scaling classes, T02 decision R-4; the tiny guard of T22 the `tiny` limits), so a consumer can change its classification without changing `measure`. An unknown ref or a malformed range is `input/invalid-argument`.
- **Writes:** nothing
- **Output:** `schema/cli/output/measure.json`
- **Exit codes and rules:** `0, 3, 5`. Specific rules: `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk measure main --json
  ```

  ```json
  {
    "range": "main",
    "files": 6,
    "added": 180,
    "removed": 42,
    "lines": 222,
    "modules": [
      "src/auth",
      "src/mail"
    ]
  }
  ```

- **Owner:** T20
- **Slice:** `measure`

#### Scenario: example run

- **WHEN** `bdk measure main --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/measure.json`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: same range, same output

- **WHEN** `bdk measure main --json` runs twice on an unchanged repository
- **THEN** both outputs are byte-identical

#### Scenario: working tree against a base

- **WHEN** `bdk measure main --json` runs on a working tree that changes 20 tracked files against `main`, one of them uncommitted
- **THEN** `files` is 20 and `lines` is the sum of added and removed lines across all 20

#### Scenario: committed range only

- **WHEN** `bdk measure main..HEAD --json` runs on the same working tree
- **THEN** `files` is 19, because the uncommitted change is outside the range

#### Scenario: ledger excluded

- **WHEN** the range changes one source file and adds three files under `.bdk/changes/`
- **THEN** `files` is 1

#### Scenario: unknown ref

- **WHEN** `bdk measure no-such-ref` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument`
