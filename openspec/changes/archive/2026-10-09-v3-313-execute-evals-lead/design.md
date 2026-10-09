# Design

## Context

See proposal.md - Why. Measured on 2026-10-09 on macOS with `/usr/bin/git` only, the issue's command, case `execute-single-part-wave`, `--runs 1 --keep-temp`:

- The trace holds one `Skill` call for `bdk:execute`, whose result is `Shell command failed for pattern "!`".../bin/bdk" config show`": [stderr] /bin/bash: /Users/Shared/bdk-eval/macos-git-prefix.sh: Operation not permitted`. The model then replies that it could not start and ends; no `Agent` call follows. The failure is in the first shell call of the skill, before any of its own text runs, so every `execute-*` case fails the same way and none of them measured `/bdk:execute` or `execute-waves`.
- The run's `config/settings.json` (written by `claude plugin eval`) has `sandbox.filesystem.denyRead` holding `//Users/<user>` and `//Users`, and `allowRead` holding the run's `home` and `tmp`, the plugin directory, and the caller's `PATH` directories that lie under `/Users`. A file in `/Users/Shared/` is therefore unreadable, whatever its permissions or extended attributes (a fresh copy fails the same way).
- The same deny list comes from the pinned Claude Code 2.1.292 (through `evals/run.ts`) and from Claude Code 2.1.295 run directly, so the pin of #300 did not cause it.
- With `/Users/Shared/bdk-eval-probe` (the prefix) and its `bin/` (the `git` copy) first on `PATH`, the same case scored 1.00 in 178 s for $1.11.

## Goals / Non-Goals

**Goals:**

- The README's `execute-*` command, with the `git` entry of "Host limits", runs the lead and its workers on a Mac without Homebrew git.
- The README command grants what `/bdk:execute` uses.
- Every `execute-*` case is run and its score recorded.

**Non-Goals:**

- Changing what the eval sandbox reads (it is Claude Code's, and no `claude plugin eval` option widens it).
- Changing `/bdk:execute` or `execute-waves` without a case run that shows a defect.

## Decisions

### D1. Host, not a regression

The lead never started because the shell prefix of the `git` host workaround was unreadable in the run, measured as above; the skills never got to run their own steps. The fix is in the eval tooling and the README, and the skills stay as they are unless the case runs after the fix show a defect.

### D2. `evals/run.ts` puts the shell prefix's directory first on the run's `PATH`

The sandbox reads under `/Users` only what the caller's `PATH` names, so the prefix's directory has to be on `PATH`. The launcher already owns the run's `PATH` (design D1 of `v3-300-eval-openspec-path`), so it adds `dirname(CLAUDE_CODE_SHELL_PREFIX)` first when the variable is an absolute path, and leaves `PATH` unchanged when it is unset, empty or relative (a relative prefix is resolved by Claude Code from a directory the launcher cannot know). An entry already on `PATH` is not repeated.

Alternatives:

- Document `PATH=/Users/Shared/bdk-eval/bin:$PATH` in every README command that needs the prefix. Lost: a second setting that has to match the first, in a dozen commands, and forgetting it fails the same silent way this issue did.
- Move the prefix under the run's own directories. Lost: the run's temporary directory is created by `claude plugin eval` after the prefix must already be set.
- Install Homebrew git on the host. Lost: it is a host change for every contributor, not a property of the repository, and the README's entry exists for hosts without it.

### D3. The prefix and its `git` copy share one directory

The prefix finds its `git` copy by its own location and puts that directory on `PATH` inside each shell. With the copy in a `bin/` below the prefix, two directories would have to be on the caller's `PATH`, and the launcher would have to know the layout. In one directory, the launcher's single entry covers both, and the prefix's `PATH` export inside the shell is that same directory. The new location is `/Users/Shared/bdk-eval/bin/` (`macos-git-prefix.sh` and its copy `git`).

Alternative: keep the layout and let the launcher add `dirname` and `dirname/bin`. Lost: it hard-codes the layout of one host workaround into the launcher.

### D4. The `execute-*` command grants `SendMessage` and `ToolSearch`

`/bdk:execute` lists both in its `allowed-tools`: `SendMessage` continues the lead after a blocker, `ToolSearch` loads `AskUserQuestion`. Without the grant a run that reaches that step reports `not granted`. The `design-*` commands already grant both the same way.

### D5. Scores recorded in the README, next to the command

As for the `run-*` cases ("Recorded 2026-10-08: ..."), the scores go into a "Recorded" line under the `execute-*` command, with date and Claude Code version. One run per case: the issue asks whether each case runs the lead and its workers, and the cost of three runs per case gains nothing for that question.

## Risks / Trade-offs

- [A later Claude Code changes the sandbox read rules] → The "Host limits" entry names the measured versions, as the other entries do; the launcher's `PATH` entry is harmless if the rule goes.
- [Contributors with the old layout (`/Users/Shared/bdk-eval/macos-git-prefix.sh`)] → It stays unreadable in a run either way; the README entry gives the new install commands, and the failure mode (`Operation not permitted` on the prefix) is named in the entry so it can be recognised.
