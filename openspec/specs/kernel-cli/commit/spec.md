# kernel-cli/commit Specification

## Purpose

Task commits (`commit`). The one kernel command that creates a task commit with BDK trailers.

Common rules, not repeated per requirement: every command may emit `input/unknown-command`, `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument`, `runtime/node-version`, `runtime/not-a-repo`; every Change-scoped command additionally `policy/no-active-change`, `state/corrupted-index`, `state/ledger-invalid`, `state/change-dir-missing`. Their meaning and exit codes are in `kernel-cli`, Exit codes and the error object; a command's `exits` in the index is derived from the classes of its specific and common rules.

Representative refusal:

```json refusal
{
  "refused": true,
  "rule": "policy/do-not-touch",
  "why": "diff for 02-3 touches src/billing/invoice.ts, which is under do-not-touch src/billing/** of part 02",
  "instead": [
    "revert the change under src/billing/",
    "bdk log add blocker \"02-3 needs a change in billing\" --ref src/billing/invoice.ts --ref 02-3"
  ]
}
```

## Requirements

### Requirement: bdk commit

Commit a task: code plus Change directory, with BDK trailers, after the diff check. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk commit <task> [--message <text>]`
- **Availability:** `orchestrator`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<task>` (required).
  - `--message <text>`. Subject line; default the task title.
- **Behaviour:** Runs the diff check of `kernel-loops`, Diff check, for the task, exactly as `attempt close` does (P6): a forbidden path refuses, an undeclared file is committed and recorded as one kernel `finding`. Stages the task's touched declared paths, its undeclared paths and `.bdk/changes/<id>/`, and commits only those paths with a pathspec commit, so files the user staged elsewhere stay staged and uncommitted. The message is the subject followed by a trailer block `BDK-Change: <change id>`, `BDK-Part: <part id>`, `BDK-Task: <task id>`, the trailers `rebuild` and `part done` read. The user's git hooks run; a failing hook refuses with `policy/git-hook-failed` and creates no commit. Refuses during a rebase, merge or cherry-pick (`policy/git-in-progress`), while a ticket whose target is the task is open (`policy/ticket-open`), and when neither a path of the task nor the Change directory changed (`policy/nothing-to-commit`). For a `tiny` Change the tiny guard runs after the commit (`kernel-loops`, Tiny guard) and its entry is part of the next commit. Main-thread git stays the user's; this is the only kernel command that creates a task commit, which is why `hooks pre-tool` denies it to subagents (T3).
- **Writes:** `git:commit`, `.bdk/changes/<id>/log/`
- **Output:** `schema/cli/output/commit.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/do-not-touch`, `policy/git-in-progress`, `policy/git-hook-failed`, `policy/nothing-to-commit`, `policy/ticket-open`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk commit 02-3 --json
  ```

  ```json
  {
    "task": "02-3",
    "commit": "d8e4f21",
    "trailers": {
      "BDK-Change": "2026-09-25-passwordless-login",
      "BDK-Part": "02",
      "BDK-Task": "02-3"
    },
    "files": [
      "src/auth/login.ts",
      "src/auth/login.test.ts",
      ".bdk/changes/2026-09-25-passwordless-login/log/20260925T101502Z-finding-L-e8k2s5vw.md"
    ]
  }
  ```

- **Owner:** T22
- **Slice:** `commit`

#### Scenario: example run

- **WHEN** `bdk commit 02-3 --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/commit.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/do-not-touch

- **WHEN** the real diff touches a `do-not-touch` path (P6)
- **THEN** the exit code is 2 and the error object carries `rule: policy/do-not-touch`

#### Scenario: policy/git-in-progress

- **WHEN** a rebase, merge or cherry-pick is in progress (V1-4)
- **THEN** the exit code is 2 and the error object carries `rule: policy/git-in-progress`

#### Scenario: policy/git-hook-failed

- **WHEN** the repository's `pre-commit` hook exits non-zero
- **THEN** the exit code is 2, the error object carries `rule: policy/git-hook-failed` with the hook's first output line, and `HEAD` is unchanged

#### Scenario: policy/nothing-to-commit

- **WHEN** neither the code nor the Change directory changed since the last commit for this task
- **THEN** the exit code is 2 and the error object carries `rule: policy/nothing-to-commit`

#### Scenario: policy/ticket-open

- **WHEN** a ticket is still open
- **THEN** the exit code is 2 and the error object carries `rule: policy/ticket-open`

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: trailers and staged user files

- **WHEN** the user staged `README.md`, task `02-3` changed `src/auth/login.ts`, and `bdk commit 02-3` runs
- **THEN** the new commit holds `src/auth/login.ts` and the Change directory but not `README.md`, which is still staged, and `git log -1 --format=%(trailers:key=BDK-Task,valueonly)` prints `02-3`
