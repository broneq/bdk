---
name: judge
description: 'Judges the findings of a BDK review round - checks each unleveled finding against the code and the rule or project instruction it cites, and sets its level (blocker, should-fix, nice-to-have, not-a-problem) by what the product does, with bdk findings level - then writes the round report with bdk findings report. Use when a review round or a user asks to judge, level, rate or triage the findings of a round, or to finish a review round.'
argument-hint: "[<round-dir>] [--workdir <path>] [--change <path>|none] [--intent <file>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git diff *) Bash(git show *) Bash(git -C *) Bash(cd *) Read Grep Glob
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Judge a review round

Set the level of every finding of one round, then write the round report. You look for no new problem, add no finding, record no decision (triage decides what happens), change no file and start no agent. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without pipes or `&&`.

If the block above says "BDK not configured: run /bdk:setup", stop and pass that line on. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## Another checkout, Change or intent

A caller that reviews code outside the working directory (`/bdk:pr-review` reviews a pull request in its own worktree) adds up to three inputs. Without them, skip this section.

- `--workdir <path>`: the checkout to review. Give every Read, Grep and Glob call an absolute path under it, and read the Change and the plan parts there too; run git as `git -C <path> <command>` (the host refuses `cd` followed by `git`) and `bdk` as `cd <path> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>`, one command per call. Never read the same paths in the working directory: that is another commit. The round directory and its log stay where the arguments say.
- `--change <path>`: the Change directory, relative to the work directory (`openspec/changes/archive/2026-10-01-monthly-report` for an archived one), in place of `openspec/changes/<change>/`. `--change none`: the range carries no Change.
- `--intent <file>`: what the author meant (a pull request's title, description and linked issues). Read it whole in step 2 with the proposal, or in its place when there is no Change: a level depends on whether the product breaks what the author meant.

## 1. Find the round

With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it. Otherwise use the highest `.bdk/runs/manual/review/round-<N>/` that holds `findings.jsonl` and no `review.md`. The log is `<round-dir>/findings.jsonl`; the Change is `openspec/changes/<change>/`, `<change>` being the directory under `.bdk/runs/`.

Run `bdk findings list <log> --level unleveled`. These are the findings to judge; a finding that already has a level keeps it.

Done when you have the list (it may be empty: go to step 4).

## 2. Read what the product must do

Read `proposal.md` and the scenarios under `specs/` of the Change: a level depends on whether the product breaks them. Read a rule a finding cites in the rules of `bdk rules for --stage review --files <file>` for its file. A `rule` that is a path (`CLAUDE.md`, `src/AGENTS.md`, `.claude/rules/testing.md`) cites a project instruction: read that file, under `--workdir` when given.

Done when you know the scenarios, the intent, and each rule and instruction file a finding cites.

## 3. Judge each finding

For each finding, once: read the code at its `file` and `line`, and its evidence. Ask:

1. Does the failure scenario hold? Trace the evidence's input through the code. A guard, a type, a caller or a test that already prevents it makes it a false positive. For a cited instruction, the scenario holds only when the cited file says what the evidence quotes, the file binds the finding's file (the finding's file is under the instruction file's directory, or a `.claude/rules` file's `paths` match it or it has none), and the changed line breaks it.
2. Which level fits, by the product's behaviour:

| Level | When |
|---|---|
| `blocker` | The product breaks a spec scenario or the intent of the Change; a check is red (source `check`); a security hole; data loss; a regression of existing behaviour |
| `should-fix` | The product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost the finding names |
| `nice-to-have` | An improvement whose absence costs nothing concrete |
| `not-a-problem` | The failure scenario does not hold; out of the Change's scope; already handled; or it repeats another finding (name that id) |

A rule or instruction violation alone is never a `blocker`, however the reviewer worded it: `should-fix` at most. A cited instruction the file does not hold, or that does not bind the finding's file, is `not-a-problem`. A finding that would be a `blocker` but whose scenario does not hold is `not-a-problem`, not a lower level. "Out of the Change's scope" means code or behaviour the Change does not touch; an improvement to what the Change touches that no scenario asks for is `nice-to-have`.

Then set it:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings level <log> <id> <level> --reason "<one sentence: why this level, citing the scenario, the rule or the guard>"
```

Done when every finding of step 1 has a level.

## 4. Write the report

Run `bdk findings list <log> --level unleveled` again: it must list none (a finding added meanwhile is judged as in step 3). Then run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings report <log>`. It writes `review.md` in the round directory, which finishes the round, and prints its path and the counts.

Done when the report exists and counts 0 unleveled.

## 5. Return

Return only the report's path and the counts line it printed, then one line per `blocker`: id and summary.
