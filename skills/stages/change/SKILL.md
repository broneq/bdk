---
name: change
description: Opens a BDK Change from an intent, or shows, lists, resumes, parks or takes over one. Use when starting a feature or a fix with BDK, or to see where the current Change stands and what to type next.
argument-hint: '"<intent>" | list | resume <id> [--option <n>] | park [--reason <text>] | takeover'
disable-model-invocation: true
allowed-tools: Bash(node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" *) Bash(echo *) Bash(git branch --show-current) Bash(git switch -c *) Read Grep Glob AskUserQuestion
---

!`node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill change 2>&1 || echo "BDK STOP: kernel unavailable (exit $?). Install Node >= 22.13 and run /bdk:setup."`

If no "BDK context: change" heading appears above, run `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" ctx skill change` first and apply its output; on a `BDK STOP` line, stop and report it.

# Change

A Change is one unit of work on one branch: its intent, design, plan, ledger and progress, kept by the kernel. This skill opens one or reports where one stands; the later stages are their own skills. Run kernel commands as `node "${CLAUDE_PLUGIN_ROOT}/dist/bdk.mjs" <command>`; this skill writes them as `bdk <command>`. Add `--json` to every command whose output you act on.

Arguments: $ARGUMENTS

## What the arguments ask for

| First word of the arguments | What you run                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------- |
| none                        | `bdk change status --json`                                                         |
| `list`                      | `bdk change list --json`, with `--all` when the user asks for archived Changes too |
| `resume`                    | `bdk change resume <id> [--option <n>] --json` with the arguments that follow      |
| `park`                      | `bdk change park [--reason <text>] --json` with the arguments that follow          |
| `takeover`                  | `bdk change takeover --json`                                                       |
| anything else               | the whole argument is the intent: open a Change as below                           |

These commands write nothing beyond what the kernel records; report their output as "Finish" says.

## Opening a Change

Done when `bdk change new` has bound a Change to the branch the user chose and the user knows the command to type next.

**Branch.** The kernel binds the Change to the current branch, and a branch holds one active Change. Ask once, with `AskUserQuestion`, whether to create a new branch or to stay on the current one (`git branch --show-current` names it). Ask this on every branch, the default branch included. The new branch is `feat/<slug>`, or `fix/<slug>` for a bug, where `<slug>` is two to five words of the intent in kebab-case. Create it with `git switch -c <name>`, which keeps uncommitted work; when git refuses because the name exists, ask for another name rather than switching to the existing branch.

**Kind.** Pass `--kind bug` when the intent reports a defect: something that worked, or should work, and does not. A bug Change goes from here straight to `/bdk:plan`.

**Profile.** `small` is the kernel's default and right for most work; it includes a design step. Pass `--profile tiny --reason "<why>"` only when, after reading the code the intent touches (the files and symbols it names, found with `Grep` and `Glob`), all of these hold:

- no new or changed behaviour visible to a user or an API;
- no change to a data model, a schema or the configuration;
- no change to a specified capability;
- at most 2 files in 1 module.

The reason states why each item holds, because it is the record of why design was skipped. Any doubt leaves the default: an undersized Change skips design and plan verification, while an oversized one costs one short step. Keep the reading to what the four items need; the design stage does the real exploration.

Then run `bdk change new "<intent>" [--kind bug] [--profile tiny --reason "<why>"] --json` with the intent as the user wrote it. Never pass `--inferred`: that flag is for a skill that opens a Change on the user's behalf.

## When the kernel refuses

- Exit 2 is a refusal: read `rule`, `why` and `instead`, and do what `instead` names. Never repeat the refused command unchanged. `policy/change-exists` means the branch already has an active Change: show it and the commands of `instead`, and open nothing.
- Exit 3 is a malformed command: fix the argument it names, using `bdk <command> --help`.
- `BDK STOP`, exit 4 or exit 5: stop and report the output to the user.

## Finish

Report in a few lines, from the kernel's output only:

- after `change new`: the Change id, its branch, kind and profile (with the reason when `tiny`), and the command to type next, which is the `next` field of the output;
- after `change status`: the stage, the gate status with each pending `review: true` entry (id and summary), and the command the gate names; for a parked Change, its options and the single resume command the kernel prints;
- after `list`, `resume`, `park` or `takeover`: what changed, and the command to type next as the output names it.

End your turn there. The next stage starts when the user types its command.
