## ADDED Requirements

### Requirement: bdk check run

Run the post-task checks of a task, a part or a review round's fix under its ticket, record their evidence and print the commit command. The kernel SHALL implement the command as this requirement and its output schema specify.

- **Synopsis:** `bdk check run <task|part|change-id> --ticket <ticket> [--skip <tool-id>]`
- **Availability:** `agent`
- **Mode:** `command`; Change-scoped
- **Arguments:**
  - `<task|part|change-id>` (required). A task of the ticket's part, the part itself, or the Change id under a `review-fix` ticket.
  - `--ticket <ticket>` (required). An open `part` or `verify-fix` ticket of the part holding the target, or the open `review-fix` round.
  - `--skip <tool-id>`. Repeatable; a `tools.test` or `tools.lint` entry whose `when` says it does not apply to the target. Only an entry with a `when` can be skipped.
- **Behaviour:** A part agent runs it after each task and the conformer after its fixes (#166), so the agent never composes, runs or records a check itself. The fixer of a review round runs it on its fix with the Change id as the target, whose files are the executable `Files:` of every plan part, in the project root. The ticket must be open and its loop `part`, `verify-fix` or `review-fix` (`policy/no-open-ticket` otherwise); a target outside the ticket's part, or other than the Change id under a `review-fix` ticket, is `input/invalid-argument`, an unknown one `input/not-found`, and `--skip` naming an unknown entry or one without `when` is `input/invalid-argument`. Steps, in order:
  1. The diff check of `kernel-loops`, Diff check, for the target in its work root: a touched path matching a forbidden glob refuses with `policy/do-not-touch` before any command runs, and nothing is recorded. Undeclared paths are reported in `diff.undeclared`; they are recorded as a kernel `finding` at `attempt close`, not here.
  2. For each post-task step kind the Change's graph applies whose evidence the kernel records (`tests-scoped` and `lint`; `kernel-pipeline`, Artifact kinds), in pipeline order, the commands of the project's tools: for `tests-scoped` each `tools.test` entry of tier `fast`, its `related`, else `scoped`, else `command`; for `lint` each `tools.lint` entry, its `scoped`, else `command`; `{files}` filled with the target's executable `Files:` (`kernel-cli/dispatch`, the same composition the runner package used), space separated in byte order. A tool group declared `none` (T49) gives no step node and runs nothing.
  3. Each command runs through `/bin/sh -c` in the work root, with stdin closed and stdout and stderr captured together, under a timeout of `execution.checks.timeout` seconds (`kernel-settings`); the commands of one call run one after another. A command still running at the timeout is killed with its process group.
  4. Each output is written to `.bdk/.machine/checks/<ticket>/<target>-<kind>-<tool-id>.txt`, replacing an earlier one of the same name, and ends with the line `exit <code>`, or `timeout <seconds>` for a killed command. A skipped entry writes the line `skipped: <when>` instead of running.
  5. One evidence manifest per kind (`kernel-cli/evidence`, bdk evidence record) with `source: kernel`, the ticket's target as its target scope narrowed to the command's target (the task's or the part's tree hash), every output file of the kind as its files, no citation, and the verdict: `fail` when a command timed out or exited non-zero other than 127; else `not-run` when the kind has no command, the target has no executable file, every entry of the kind was skipped or a command was not found (exit code 127); else `pass`, every command run having exited 0. A check that was skipped carries `skipped` with its entry's `when` and no exit. A manifest equal to the latest one is not written again, as `evidence record` deduplicates.
- **Output:** each check's `kind`, `tool`, `command`, `exit` (or `timeout`), `verdict`, `file` and, for a failing check, `tail`, the last 20 lines of its output; `evidence`, the manifest id per kind; `diff` with `declared`, `touched` and `undeclared`; the overall `verdict`, `fail` when any kind failed, `not-run` when none passed or failed, else `pass`; and, when the overall verdict is not `fail` and the target has touched declared paths, `commit`: the paths and the exact command that commits them with `git` (`kernel-loops`, Progress from git):
  - for a task: `git add -- <paths> && git commit -m '<task title>' --trailer 'BDK-Change: <change id>' --trailer 'BDK-Part: <part id>' --trailer 'BDK-Task: <task id>' -- <paths>`, each word shell-quoted;
  - for a part: the same with `-m 'refactor(<part id>): conform part <part id>'` and `--trailer 'BDK-Ticket: <ticket>'` in place of `BDK-Task`.

  The paths are the touched paths the target declares in its work root, so another part's work in flight never enters the commit; inside a worktree part the command is prefixed with `cd <worktree> &&`. A review round's fix gets no `commit`: `bdk commit <change-id>` commits it under the round's `BDK-Ticket` (`kernel-cli/commit`). While a merge is in progress in the work root (a merge ticket, `kernel-cli/attempt`, Merge conflict ticket) the output has no `commit`: git refuses a partial commit during a merge, and the `ok` close of the merge ticket commits the merge. The exit code is 0 whenever the checks ran, whatever their verdict: the verdict is data the agent acts on. The text form prints one line per check, the tail of each failing one and the commit command last.

- **Writes:** `.bdk/.machine/checks/`, `.bdk/changes/<id>/evidence/`, `.bdk/.machine/evidence/`
- **Output:** `schema/cli/output/check-run.json`
- **Exit codes and rules:** `0, 2, 3, 4, 5`. Specific rules: `input/not-found`, `policy/no-open-ticket`, `policy/do-not-touch`, `runtime/git-missing`; plus the common rules of every command and of Change-scoped commands (`kernel-cli`, Exit codes and the error object).
- **Example:**

  ```bash
  bdk check run 02-3 --ticket A-7f3k9m2q --json
  ```

  ```json
  {
    "target": "02-3",
    "ticket": "A-7f3k9m2q",
    "verdict": "pass",
    "checks": [
      {
        "kind": "tests-scoped",
        "tool": "vitest",
        "command": "pnpm vitest related --run src/auth/login.ts src/auth/login.test.ts",
        "exit": 0,
        "verdict": "pass",
        "file": ".bdk/.machine/checks/A-7f3k9m2q/02-3-tests-scoped-vitest.txt"
      },
      {
        "kind": "lint",
        "tool": "eslint",
        "command": "pnpm eslint src/auth/login.ts src/auth/login.test.ts",
        "exit": 0,
        "verdict": "pass",
        "file": ".bdk/.machine/checks/A-7f3k9m2q/02-3-lint-eslint.txt"
      }
    ],
    "evidence": {
      "tests-scoped": "E-b6n9t2kq",
      "lint": "E-c7p3v4mr"
    },
    "diff": {
      "declared": [
        "src/auth/login.test.ts",
        "src/auth/login.ts"
      ],
      "touched": [
        "src/auth/login.test.ts",
        "src/auth/login.ts"
      ],
      "undeclared": []
    },
    "commit": {
      "paths": [
        "src/auth/login.test.ts",
        "src/auth/login.ts"
      ],
      "command": "git add -- src/auth/login.test.ts src/auth/login.ts && git commit -m 'Accept a magic link token' --trailer 'BDK-Change: 2026-09-25-passwordless-login' --trailer 'BDK-Part: 02' --trailer 'BDK-Task: 02-3' -- src/auth/login.test.ts src/auth/login.ts"
    }
  }
  ```

- **Owner:** T22
- **Slice:** `check`

#### Scenario: example run

- **WHEN** `bdk check run 02-3 --ticket A-7f3k9m2q --json` runs as in the example
- **THEN** the exit code is 0 and stdout validates against `schema/cli/output/check-run.json`

#### Scenario: input/not-found

- **WHEN** the referenced object does not exist in the active Change, the configuration or the bundle
- **THEN** the exit code is 3 and the error object carries `rule: input/not-found`

#### Scenario: policy/no-open-ticket

- **WHEN** the ticket named is closed, or is a `verifier` ticket
- **THEN** the exit code is 2, the error object carries `rule: policy/no-open-ticket`, and no command runs

#### Scenario: policy/do-not-touch

- **WHEN** the working tree changes a path matching the `do-not-touch` of part `02` and `bdk check run 02-3 --ticket <ticket>` runs
- **THEN** the exit code is 2, the error object carries `rule: policy/do-not-touch`, no command runs and no evidence is recorded

#### Scenario: runtime/git-missing

- **WHEN** no `git` executable on `PATH`
- **THEN** the exit code is 5 and the error object carries `rule: runtime/git-missing`

#### Scenario: a target outside the ticket's part

- **WHEN** ticket `A-7f3k9m2q` is a `part 02` ticket and `bdk check run 03-1 --ticket A-7f3k9m2q` runs
- **THEN** the exit code is 3 with `rule: input/invalid-argument` naming part `02`

#### Scenario: failing test

- **WHEN** the `tests-scoped` command exits 1 and prints 30 lines
- **THEN** the exit code is 0, the check has `verdict: fail` and `tail` holding the last 20 lines, the output file ends with `exit 1`, the `tests-scoped` manifest has verdict `fail`, the overall verdict is `fail` and the output has no `commit`

#### Scenario: a command that reads stdin does not hang

- **WHEN** a `tools.lint` entry's command is `cat` and `bdk check run 02-3 --ticket <ticket>` runs from a shell whose stdin never closes
- **THEN** the command ends at once with exit 0, since its stdin is closed, and `bdk check run` returns

#### Scenario: timeout

- **WHEN** `execution.checks.timeout` is 10, the minimum, and a test command sleeps for 60 seconds
- **THEN** the command is killed after 10 seconds, its output file ends with `timeout 10`, its check and the `tests-scoped` manifest have verdict `fail`, and the call exits 0 within 20 seconds

#### Scenario: no executable file

- **WHEN** every `Files:` path of task `02-1` is Markdown
- **THEN** no command runs and the `tests-scoped` and `lint` manifests have verdict `not-run`

#### Scenario: tool not installed

- **WHEN** the lint command exits 127
- **THEN** the `lint` check and manifest have verdict `not-run`

#### Scenario: skipped entry

- **WHEN** `tools.test` holds a fast entry `pytest` with `when: "only for Python files"` and `bdk check run 02-3 --ticket <ticket> --skip pytest` runs
- **THEN** `pytest` does not run, its output file holds `skipped: only for Python files`, and the verdict of `tests-scoped` comes from the other entries

#### Scenario: skipping an entry without when

- **WHEN** `--skip vitest` names an entry with no `when`
- **THEN** the exit code is 3 with `rule: input/invalid-argument` and no command runs

#### Scenario: outputs per ticket

- **WHEN** tickets `A-aaaaaaaa` of part `01` and `A-bbbbbbbb` of part `02` run `bdk check run` at the same time
- **THEN** each writes only under `.bdk/.machine/checks/<its ticket>/`, and each manifest lists only its own ticket's files

#### Scenario: commit command of a part

- **WHEN** the conformer of ticket `A-7f3k9m2q` changed `src/auth/login.ts` of part `02` and `bdk check run 02 --ticket A-7f3k9m2q --json` passes
- **THEN** `commit.command` commits `src/auth/login.ts` with the subject `refactor(02): conform part 02` and the trailers `BDK-Change`, `BDK-Part: 02` and `BDK-Ticket: A-7f3k9m2q`

#### Scenario: nothing to commit

- **WHEN** the checks of part `02` pass and the working tree changes no path of the part
- **THEN** the output has no `commit`

#### Scenario: the fix of a review round

- **WHEN** the fixer of review round `A-r2v2w3x4` changed `src/auth/login.ts` and `bdk check run 2026-09-25-passwordless-login --ticket A-r2v2w3x4 --json` runs
- **THEN** the `tests-scoped` and `lint` commands run with the executable `Files:` of every plan part, one manifest per kind targets the Change, and the output has no `commit`

#### Scenario: no commit during a merge

- **WHEN** a merge ticket of worktree part `02` resolved its conflicts and `bdk check run 02 --ticket <ticket>` passes while the merge is still in progress in the worktree
- **THEN** the output has no `commit`, and `bdk attempt close <ticket> ok` commits the merge

#### Scenario: evidence closes the ticket

- **WHEN** every task of part `02` is committed, the conformer's report is stored, and `bdk check run 02 --ticket <ticket>` passed on the current tree
- **THEN** `bdk attempt close <ticket> ok` finds fresh `tests-scoped` and `lint` evidence and exits 0
