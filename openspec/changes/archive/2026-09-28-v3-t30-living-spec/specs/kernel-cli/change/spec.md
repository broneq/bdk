## MODIFIED Requirements

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
