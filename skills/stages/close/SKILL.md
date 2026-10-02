---
name: close
description: Closes the reviewed BDK Change - merges its spec deltas, archives it in one commit, regenerates drifted rule files and reports the PR summary. Use when a Change waits on /bdk:close after review.
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Bash(git log -1 --oneline) Read
disallowed-tools: Edit Write NotebookEdit
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill close 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: close" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill close` first and apply its output; on a `BDK STOP` line, stop and report it.

# Close

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

Closing ends a Change: the kernel merges its spec deltas into the living specs, routes its lessons, archives it and commits the archive. The kernel does all of it in one command; this skill checks that the close can go through, keeps the rule files current and hands the user the PR summary. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

Done when `bdk change close` has archived the Change, or a refusal you cannot resolve is reported, and you have given the report of "Finish". Ask the user nothing: the typed `/bdk:close`, or the run that passed `gate:review`, is the consent. You never edit a file, and you propose no rule: the lessons stay in the archived ledger.

## Closing

1. Run `bdk next --json`. When it returns a node of an earlier stage, the Change is not ready to close: report that node and the command it names, and close nothing.
2. Run `bdk change close --dry-run --json`. It writes nothing and refuses what the real close would refuse, such as `policy/ticket-open` for a ticket still open. On a refusal, follow "When the kernel refuses" and close nothing.
3. Run `bdk rules export --claude --check --json`. On `policy/generated-drift`, run `bdk rules export --claude --json` and keep the `path` of each file with `changed: true`. The close commit stages only `.bdk/`, so these files go into the PR as the user's own commit.
4. Run `bdk change close --json`, then `git log -1 --oneline` for the close commit.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged.
- `policy/git-hook-failed` from `bdk change close` means a git hook rejected the close commit: the archive stays in the work tree. Report the hook's output from the refusal and stop; the user fixes the hook's cause and commits.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- A `BDK STOP` line, exit 4 or exit 5: stop and report the output.

## Finish

Report from the kernel's output only:

- the `summary` of `bdk change close`, verbatim: it is the PR description;
- the gates passed by policy, from `gatesByPolicy`, or that every gate was passed by the user;
- the archive path from `archivedTo`, and the close commit;
- the regenerated rule files, when step 3 wrote any, for the user to commit;
- the next step: open the PR with this summary. You do not open the PR: publishing it is the user's step.

When `/bdk:run` started this skill, the report is the last part of the run.
