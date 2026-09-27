## MODIFIED Requirements

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
- **Behaviour:** Read-only, at most 100 lines in text mode. Shows which gates were passed by the user and which by policy (`passedBy`), an inferred intent as unconfirmed (`confirmed: false` while `change.md` carries `source: inferred` and the ledger holds no `transition` with `source: user`), the effective profile and stage derived from the ledger (`kernel-state`, Derived state and mutation), and, when parked, the options and the single resume command. This is the second place (after the previous stage skill's closing output) where the user sees pending `review: true` entries before typing the next stage command. `nodes` lists every node of the Change's graph in pipeline order with instances expanded, skipped nodes included, each with its state, requirements, recorded input hash and `why` (`kernel-pipeline`, Node states); `gates` lists every gate with `ready`, `done`, `passedBy`, `command` and the pending `review: true` entries (T21). In text mode the node list collapses done instances of one collection into one line so the 100-line limit holds. `parts` stays an empty array until plan parts land (T22).
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
