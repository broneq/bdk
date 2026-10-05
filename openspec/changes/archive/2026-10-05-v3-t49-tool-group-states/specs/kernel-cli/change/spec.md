## MODIFIED Requirements

### Requirement: bdk change new

Open a Change on the current branch from an intent and record its starting profile. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change new <intent> [--kind feature|bug|review] [--profile tiny|small|large] [--reason <text>] [--inferred] [--base <ref>]`
- **Availability:** `orchestrator`
- **Mode:** `command`
- **Arguments:**
  - `<intent>` (required). One sentence or a quoted paragraph; with --kind bug the reproduction.
  - `--kind feature|bug|review`. Graph variant; default feature (T02 decision R-8). `review` is a review of work already on the branch, opened by `/bdk:cr` (T42).
  - `--profile tiny|small|large`. Starting profile, judged by the calling skill; default small (R-profil).
  - `--reason <text>`. Why this profile; written into the body of the profile assumption entry. Required with --profile tiny.
  - `--inferred`. The Change is opened on the user's behalf by another skill; stamped source: inferred (R-12).
  - `--base <ref>`. Only with `--kind review`: the commit the review starts from is `git merge-base HEAD <ref>`; default `origin/HEAD`.
- **Behaviour:** Creates `.bdk/changes/<id>/` with `change.md` (written once, never mutated), records the starting profile as an `assumption` entry (`source: kernel`, `refs: [change.md]`, `--reason` as its body) and the D4b list of locally overridden keys (`overridden` in `change.md`, names only, from the resolved configuration), and binds the Change to the current branch (`kernel-state`, Branch binding). The kernel does not measure the intent: one sentence carries too little to size a Change, and each size decision is taken where its information exists. Whether the Change is trivial enough to skip design (`tiny`, S7) is judged by the calling skill before the Change exists; `small` is the default, because an undersized Change skips design and plan verification while an oversized one costs one short step. `--profile tiny` without `--reason` is `input/missing-argument`, so every skipped design carries its justification in the ledger. `large` at start is for a user who already knows the Change spans several subsystems; otherwise the profile is raised later by a `decision` entry carrying `profile` (`kernel-state`, Derived state and mutation). The Change id is the kernel clock's UTC date plus a kebab-case slug of the intent's first words, at most 40 characters, `change` when the intent yields no slug character. With `--inferred` the intent is the first sentence of the caller's context and `change status` shows the Change as unconfirmed until the user runs a stage command. Refuses when the branch already has an active Change that is not archived, and when the Change directory for the computed id exists (`policy/change-exists` naming the directory, `instead` suggesting a more specific intent); refuses on a detached `HEAD`, because a Change binds to a branch. **Tool groups (T49).** Before the first write, `change new` refuses with `policy/tools-unset` when a tool group whose nodes the Change kind's graph applies is unset (`kernel-pipeline`, Tool group nodes; with the shipped pipeline both `tools.test` and `tools.lint`, for every kind); `why` names each unset group and the nodes it would run, `instead` names `bdk config set tools.<group>.<id> '{tier: <tier>, command: <command>}'`, `bdk config set tools.<group> none` and `/bdk:setup`, and nothing is written. When the settings do not validate the check is left out and the Change opens as below. **Review Changes (T42).** With `--kind review` the kernel resolves the base as `git merge-base HEAD <ref>` and stamps it as `base` in `change.md`, the commit the Change's range starts from (`kernel-state`, Change document); `--base` without `--kind review` is `input/invalid-argument`, a `<ref>` that names no commit or has no merge base with `HEAD` is `input/not-found` naming the ref, with `instead` naming `--base <ref>`, and a base equal to `HEAD` is `policy/empty-range`, because there is nothing to review; nothing is written in either case. Before writing, the project `.gitignore` is completed through the ignored-paths rule (`kernel-state`, Ignored paths). `next` is the stage command of the first actionable node of the new Change's graph (`kernel-pipeline`, Graph variants): `/bdk:design` for a `small` or `large` feature, `/bdk:plan` for `tiny` and for `bug`, `/bdk:cr` for `review`. When the graph cannot be read (the settings hold a key the graph refuses), the Change is still opened and `next` is left out; `bdk next` then answers the refusal.
- **Writes:** `.bdk/changes/<id>/change.md`, `.bdk/changes/<id>/log/`, `.bdk/.machine/`, `.gitignore`
- **Output:** `schema/cli/output/change-new.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/change-exists`, `policy/detached-head`, `policy/empty-range`, `policy/tools-unset`, `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: review Change

- **WHEN** `bdk change new "Review the login branch" --inferred --kind review --json` runs on a branch two commits ahead of `origin/HEAD`
- **THEN** `change.md` carries `kind: review`, `source: inferred` and `base` equal to `git merge-base HEAD origin/HEAD`, and the output has `next: /bdk:cr`

#### Scenario: input/not-found

- **WHEN** `bdk change new "x" --kind review --base no-such-branch` runs
- **THEN** the exit code is 3, the error object carries `rule: input/not-found` naming `no-such-branch`, and no file is written

#### Scenario: policy/empty-range

- **WHEN** `bdk change new "x" --kind review` runs on a branch whose `HEAD` equals its merge base with `origin/HEAD`
- **THEN** the exit code is 2, the error object carries `rule: policy/empty-range`, and no file is written

#### Scenario: policy/tools-unset

- **WHEN** `.bdk/settings.yaml` configures `tools.test` and does not set `tools.lint`, and `bdk change new "Add passwordless login" --json` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/tools-unset`, `why` names `tools.lint`, `instead` names `bdk config set tools.lint none` and `/bdk:setup`, and no file is written

#### Scenario: declared none opens the Change

- **WHEN** `tools.test` is configured, `tools.lint` is `none`, and `bdk change new "Add passwordless login" --json` runs
- **THEN** the exit code is 0 and the Change is open

#### Scenario: base without a review kind

- **WHEN** `bdk change new "x" --base main` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` and no file is written

### Requirement: bdk change status

The active Change at a glance: stage, graph state, gate status with pending review entries, parked options. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change status`
- **Availability:** `read`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - none beyond `--json` and `--help`.
- **Behaviour:** Read-only, at most 100 lines in text mode. Shows which gates were passed by the user and which by policy (`passedBy`), an inferred intent as unconfirmed (`confirmed: false` while `change.md` carries `source: inferred` and the ledger holds no `transition` with `source: user`), the effective profile and stage derived from the ledger (`kernel-state`, Derived state and mutation), and, when parked, the options and the single resume command. This is the second place (after the previous stage skill's closing output) where the user sees pending `review: true` entries before typing the next stage command. `nodes` lists every node of the Change's graph in pipeline order with instances expanded, skipped nodes included, each with its state, requirements, recorded input hash and `why` (`kernel-pipeline`, Node states); `gates` lists every gate with `ready`, `done`, `passedBy`, `command` and the pending `review: true` entries (T21). In text mode the node list collapses done instances of one collection into one line so the 100-line limit holds. `parts` lists every plan part as `part list` does (`kernel-cli/part`, bdk part list), and is empty while the Change has no plan parts. `tools` holds the state of each tool group the pipeline runs, `test` and `lint`, as `configured`, `none` or `unset` (`kernel-settings`, Tool entries). The text form prints one line per declared-none group: `tools: lint not used (tools.lint is none)`, and for `test` the warning `warning: no test tool (tools.test is none): this Change runs no test`.
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
    ],
    "tools": {
      "test": "configured",
      "lint": "none"
    }
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

#### Scenario: a group declared none in the status

- **WHEN** `tools.lint` is `none` and `bdk change status` runs
- **THEN** the JSON output has `tools.lint: none`, the `lint` and `lint-full` nodes are `skipped`, and the text form holds `tools: lint not used (tools.lint is none)`

#### Scenario: no test tool is a warning

- **WHEN** `tools.test` is `none` and `bdk change status` runs in text mode
- **THEN** the output holds `warning: no test tool (tools.test is none): this Change runs no test`

#### Scenario: parts in the status

- **WHEN** a Change has plan parts `01` (done) and `02` (started, one of three tasks committed)
- **THEN** `change status --json` lists both in `parts` with the same `state`, `tasks` and `done` values as `part list --json`

### Requirement: bdk change close

Close the Change after the review gate: spec merge, archive, PR summary. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk change close [--dry-run]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `--dry-run`. Report what would be merged and archived; write nothing.
- **Behaviour:** The checks run in this order, the first failing one refusing, and nothing is written before all pass: the `close` node is ready, that is `gate:review` is done through a `source: user` or `source: policy` transition (`policy/gate-not-ready`); no ticket of the Change is open (`policy/ticket-open`); every live `finding`, `observation` and `blocker` has a disposition other than `fix` (`policy/undecided-entries`, naming each such entry, with `instead` naming `/bdk:cr --report` and `bdk log decide <id> fix|defer|reject|track`; `kernel-cli/log`, bdk log decide); progress from git trailers agrees with the attempt records (`state/trailer-mismatch`, `kernel-loops`, Progress from git); no rebase, merge or cherry-pick is in progress (`policy/git-in-progress`); then `spec merge`'s checks in its order (`policy/merge-hash-mismatch`, `policy/spec-conflict`, `policy/spec-invalid`), so a manual spec edit is caught here at the latest. Then, unless `--dry-run`: the merge writes `.bdk/specs/`; the `close` transition entry is written (`source: kernel`); `dispatch/` and `reports/` are pruned to their hash indexes unless `archive.keep-evidence` (`kernel-state`, Pruned index); the Change directory moves to `.bdk/changes/archive/<id>/` (the id already starts with its creation date); the branch marker of the Change is removed, so the branch has no active Change; one pathspec commit, subject `chore(bdk): close <id>` with the trailer `BDK-Change: <id>`, stages `.bdk/specs/`, `.bdk/changes/<id>/` and `.bdk/changes/archive/<id>/` only, so files the user staged are never swept in. A git hook rejecting that commit is `policy/git-hook-failed`; the archive stays in the work tree for the user to commit. The output's `summary` is the PR summary in Markdown, built from the ledger alone: the intent from `change.md`, the live `decision`, `assumption` and `risk` entries, the live `finding`, `observation` and `blocker` entries as open findings, each with its disposition (`deferred`, or `tracked in <issue>`) and marked when it carries `review: true`, the merged capabilities, and, when a tool group is declared none, a `### Checks` section with one line per such group (`- No test tool (tools.test is none): this Change ran no test`, `- Lint not used (tools.lint is none)`). `toolsNotUsed` lists the declared-none groups, sorted, empty when every group is configured (T49). `gatesByPolicy` lists the gates passed by a `source: policy` transition. `spec.unchanged` is true when the Change has no delta. Close routes no `learning` entry and proposes no rule: lessons and findings stay in the archived ledger, where the audit view `bdk rules stats` reads them (`kernel-cli/rules`; user decision 2026-09-30). `--dry-run` is the form `/bdk:close` runs first to show the user what will happen: the same checks and the same output, with `archivedTo` naming the target path, and nothing written. `--squash` is not part of contract version 3 (user decision, 2026-09-28): a squash merge of the PR folds the checkpoint commits without rewriting the commits that trailers and attempt records name.
- **Writes:** `.bdk/changes/<id>/log/`, `.bdk/changes/archive/<id>/`, `.bdk/specs/`, `git:commit`
- **Output:** `schema/cli/output/change-close.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `policy/gate-not-ready`, `policy/ticket-open`, `policy/undecided-entries`, `policy/spec-conflict`, `policy/spec-invalid`, `policy/merge-hash-mismatch`, `policy/git-in-progress`, `policy/git-hook-failed`, `state/trailer-mismatch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
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
    "gatesByPolicy": [],
    "toolsNotUsed": [],
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

#### Scenario: policy/undecided-entries

- **WHEN** `gate:review` is done and a live finding triaged `should-fix` has no disposition
- **THEN** the exit code is 2, the error object carries `rule: policy/undecided-entries` naming the finding's id, and nothing is written

#### Scenario: a fix not yet made

- **WHEN** a live finding carries `disposition: fix` and no later round resolved it
- **THEN** `bdk change close` exits 2 with `rule: policy/undecided-entries` naming the finding's id

#### Scenario: summary carries dispositions

- **WHEN** one live finding is deferred with `review: true` and another is tracked in `https://github.com/acme/app/issues/88`, and the Change closes
- **THEN** `summary` lists the first as deferred and to be reviewed, and the second with the issue link

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

#### Scenario: close names a group not used

- **WHEN** `tools.lint` is `none` and the Change closes
- **THEN** the output has `toolsNotUsed: [lint]` and `summary` holds a `### Checks` section with the line `- Lint not used (tools.lint is none)`

#### Scenario: close proposes no rule

- **WHEN** the Change holds `learning` entries whose fingerprints recur in three other Changes and `change close` runs
- **THEN** no entry changes status, no file under `.bdk/rules/` or `.claude/rules/` changes, and the output has no `learning` field
