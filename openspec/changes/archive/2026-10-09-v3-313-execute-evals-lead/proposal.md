# Proposal

## Why

Tracks #313.

Every `execute-*` eval case failed on 2026-10-09 within seconds: `/bdk:execute` fired, but no `bdk:lead` agent started and no `state.json` or `execute/result.md` was written. The run transcripts show why: the skill's `!` block `bdk config show` fails with `/bin/bash: /Users/Shared/bdk-eval/macos-git-prefix.sh: Operation not permitted`, and the model stops before starting the lead. The shell prefix of the `git` entry of "Host limits" (`CLAUDE_CODE_SHELL_PREFIX`) wraps every Bash call of a run, and the run's sandbox cannot read it: the sandbox settings `claude plugin eval` writes deny reads under `/Users` as a whole (`denyRead` holds `//Users` next to the home directory) and let through only the directories on the caller's `PATH` (`allowRead`). Measured with the pinned Claude Code 2.1.292 and with 2.1.295, so it is the host, not a regression of `/bdk:execute`, `execute-waves` or #306. The same case scores 1.00 when the prefix's directory is on `PATH`.

Two smaller defects: the README command of the `execute-*` cases grants no `SendMessage` (the stage continues its lead with it after a blocker) and no `ToolSearch` (it loads `AskUserQuestion` with it), and the three cases of #306 were merged without a run.

## What Changes

- `plugins/bdk/evals/run.ts` puts the directory of `CLAUDE_CODE_SHELL_PREFIX` first on the `PATH` the run inherits when the variable names an absolute path, so the sandbox lets the prefix through.
- `macos-git-prefix.sh` expects its `git` copy in its own directory instead of a `bin/` below it, so one directory on `PATH` covers both; the "Host limits" `git` entry installs both into `/Users/Shared/bdk-eval/bin/` and records the measured cause.
- The README command of the `execute-*` cases grants `SendMessage` and `ToolSearch`; the README records the scores of every `execute-*` case.
- The "Host limits" entry "`PATH` leaks from the caller" also says that a Claude Code session may refuse nested `claude plugin eval` runs, so paid runs start from a plain terminal.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-evals`: the "Local run" requirement adds that the directory of the shell prefix is put first on the run's `PATH`.

## Impact

- Code: `plugins/bdk/evals/run.ts`, `plugins/bdk/evals/macos-git-prefix.sh`, `plugins/bdk/tests/evals.test.ts`.
- Docs: `plugins/bdk/evals/README.md` ("Cases" command of `execute-*`, "Host limits"). Nothing a BDK user sees changes: the eval suite is a contributor tool and is not released, so no `docs/guide/` or `docs/concepts/` page changes and the Change has no Docs task group.
- No skill changes unless a case run shows a defect of `/bdk:execute` or `execute-waves`; such a defect is fixed or filed as its own issue (see tasks).
