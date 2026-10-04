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
- **Behaviour:** Creates `.bdk/changes/<id>/` with `change.md` (written once, never mutated), records the starting profile as an `assumption` entry (`source: kernel`, `refs: [change.md]`, `--reason` as its body) and the D4b list of locally overridden keys (`overridden` in `change.md`, names only, from the resolved configuration), and binds the Change to the current branch (`kernel-state`, Branch binding). The kernel does not measure the intent: one sentence carries too little to size a Change, and each size decision is taken where its information exists. Whether the Change is trivial enough to skip design (`tiny`, S7) is judged by the calling skill before the Change exists; `small` is the default, because an undersized Change skips design and plan verification while an oversized one costs one short step. `--profile tiny` without `--reason` is `input/missing-argument`, so every skipped design carries its justification in the ledger. `large` at start is for a user who already knows the Change spans several subsystems; otherwise the profile is raised later by a `decision` entry carrying `profile` (`kernel-state`, Derived state and mutation). The Change id is the kernel clock's UTC date plus a kebab-case slug of the intent's first words, at most 40 characters, `change` when the intent yields no slug character. With `--inferred` the intent is the first sentence of the caller's context and `change status` shows the Change as unconfirmed until the user runs a stage command. Refuses when the branch already has an active Change that is not archived, and when the Change directory for the computed id exists (`policy/change-exists` naming the directory, `instead` suggesting a more specific intent); refuses on a detached `HEAD`, because a Change binds to a branch. **Review Changes (T42).** With `--kind review` the kernel resolves the base as `git merge-base HEAD <ref>` and stamps it as `base` in `change.md`, the commit the Change's range starts from (`kernel-state`, Change document); `--base` without `--kind review` is `input/invalid-argument`, a `<ref>` that names no commit or has no merge base with `HEAD` is `input/not-found` naming the ref, with `instead` naming `--base <ref>`, and a base equal to `HEAD` is `policy/empty-range`, because there is nothing to review; nothing is written in either case. Before writing, the project `.gitignore` is completed through the ignored-paths rule (`kernel-state`, Ignored paths). `next` is the stage command of the first actionable node of the new Change's graph (`kernel-pipeline`, Graph variants): `/bdk:design` for a `small` or `large` feature, `/bdk:plan` for `tiny` and for `bug`, `/bdk:cr` for `review`. When the graph cannot be read (the settings hold a key the graph refuses), the Change is still opened and `next` is left out; `bdk next` then answers the refusal.
- **Writes:** `.bdk/changes/<id>/change.md`, `.bdk/changes/<id>/log/`, `.bdk/.machine/`, `.gitignore`
- **Output:** `schema/cli/output/change-new.json`
- **Exit codes and rules:** `0, 2, 3, 5`. Specific rules: `input/not-found`, `policy/change-exists`, `policy/detached-head`, `policy/empty-range`, `runtime/git-missing`; plus the common rules of every command (`kernel-cli`, Exit codes and the error object).
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

#### Scenario: base without a review kind

- **WHEN** `bdk change new "x" --base main` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` and no file is written
