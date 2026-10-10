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

Set the level of every finding of one round, then write the round report. You look for no new problem, add no finding, record no decision (triage decides what happens), change no file and start no agent. Run every `bdk` call as the steps write it, `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` and each argument written out, as the whole Bash command: nothing before or after it, no `cd`, `;`, `&&`, `|` or `echo`, no shell variable. The permission rule allows `bdk` only on its own, so another form can be denied, and a denied call ends the block. The `--workdir` form below is the one exception. Read and list files with Read, Grep and Glob, not through Bash.

If the block above says "BDK not configured: run /bdk:setup", stop and pass that line on. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## Another checkout, Change or intent

A caller that reviews code outside the working directory (`/bdk:pr-review` reviews a pull request in its own worktree) adds up to three inputs. Without them, skip this section.

- `--workdir <path>`: the checkout to review. Give every Read, Grep and Glob call an absolute path under it, and read the Change and the plan parts there too; run git as `git -C <path> <command>` (the host refuses `cd` followed by `git`) and `bdk` as `cd <path> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>`, one command per call. Never read the same paths in the working directory: that is another commit. The round directory and its log stay where the arguments say.
- `--change <path>`: the Change directory, relative to the work directory (`openspec/changes/archive/2026-10-01-monthly-report` for an archived one), in place of `openspec/changes/<change>/`. `--change none`: the range carries no Change.
- `--intent <file>`: what the author meant (a pull request's title, description and linked issues). Read it whole in step 2 with the proposal, or in its place when there is no Change: a level depends on whether the product breaks what the author meant.

## 1. Find the round

With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it. Otherwise use the highest `.bdk/runs/manual/review/round-<N>/` that holds `findings.jsonl` and no `review.md`. The log is `<round-dir>/findings.jsonl`; the Change is `openspec/changes/<change>/`, `<change>` being the directory under `.bdk/runs/`.

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log> --level unleveled`. These are the findings to judge; a finding that already has a level keeps it.

Done when you have the list (it may be empty: go to step 4).

## 2. Read what the product must do

Read `proposal.md` and the scenarios under `specs/` of the Change: a level depends on whether the product breaks them. When a finding says a test is missing, also read the `Acceptance scenarios` and `Verified by` lines of the plan parts under `plan/parts/` (step 3 tells an owed test from an optional one by them). Read a rule a finding cites in the rules of `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" rules for --stage review --files <file>` for its file. A `rule` that is a path (`CLAUDE.md`, `src/AGENTS.md`, `.claude/rules/testing.md`) cites a project instruction: read that file, under `--workdir` when given. For an `e2e-check` finding, read the path file its evidence names (`<round-dir>/e2e/<process>--<path>.md`): its `Proposal:` line, `## Steps`, `## Expected` and `## Observed`.

Done when you know the scenarios, the intent, each rule and instruction file a finding cites, and each path file an `e2e-check` finding names.

## 3. Judge each finding

For each finding, once: read the code at its `file` and `line`, and its evidence. Ask:

1. Does the failure scenario hold? Trace the evidence's input through the code. A guard, a type, a caller or a test that already prevents it makes it a false positive. For a cited instruction, the scenario holds only when the cited file says what the evidence quotes, the file binds the finding's file (the finding's file is under the instruction file's directory, or a `.claude/rules` file's `paths` match it or it has none), and the changed line breaks it.
2. Which level fits, by the product's behaviour:

| Level | When |
|---|---|
| `blocker` | The product breaks a spec scenario or the intent of the Change; the spec deltas would not describe the product after archive (source `spec-conformance`, the problem holds); an E2E path fails (source `e2e-check`, the observation holds); a check is red (source `check`); a security hole; data loss; a regression of existing behaviour |
| `should-fix` | The product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost the finding names; or a scenario the Change owes has no test |
| `nice-to-have` | An improvement whose absence costs nothing concrete, including a test no scenario the Change owes asks for |
| `not-a-problem` | The failure scenario does not hold; out of the Change's scope; already handled; or it repeats an earlier finding of the log (name that id) |

A `spec-conformance` finding compares the spec text with the product. Check both sides: read the spec location its evidence names (the delta under `openspec/changes/<change>/specs/`, and the main spec under `openspec/specs/` for a modified requirement) and trace the evidence's input through the code. It holds when they disagree: a scenario or a SHALL sentence the code breaks, or behaviour a user can observe that no delta or main spec describes. A holding one is a `blocker` even when the product works (an undocumented error message): `/bdk:close` refuses to archive the Change while it is open, so leaving it would stop the run there. When the spec already says what the product does, it is `not-a-problem`.

An `e2e-check` finding is a path the E2E tester drove and saw fail; its `file` and `line` are the proposal line the path comes from. Trace the input of the path file's `## Steps` through the code: the finding holds when the code gives what `## Observed` says (the crash, the text, the exit code). A holding one is a `blocker`: `/bdk:close` refuses to archive the Change while an E2E path fails, so a lower level would stop the run there. That stays so when the spec deltas or `design.md` word the promise more narrowly than the proposal line, or leave the path's input out ("malformed entries are unspecified"), and for a `break` path held to the baseline (`Expected from: baseline`): the proposal line is the intent, and a narrower delta or design is a gap in them, not leave to break the promise. Whether the round fixes the code or the user narrows the proposal is triage's and the fix planner's call, not yours. When the code does not give what the file observed, it is `not-a-problem`.

A finding that a test is missing names behaviour, often not its scenario: find the scenario yourself. The Change owes a scenario's test when the scenario is in its spec deltas, or a plan part names it under `Acceptance scenarios` or `Verified by`. The finding holds when no test would fail if that behaviour broke; a test that covers it at another level makes it `not-a-problem`. With the behaviour present it is `should-fix`, never `nice-to-have`, however the evidence words it ("only a test is missing"): the plan's acceptance is unmet, and a regression of the scenario would pass every check. With the behaviour broken it is a `blocker`. A test gap no owed scenario asks for (an input class no scenario writes out, a helper's branch) is `nice-to-have`.

Of two findings that repeat each other, the later one in the log is the repeat: level it `not-a-problem` naming the earlier id, and judge the earlier one on its own (a caller seeds findings it must keep first). A rule or instruction violation alone is never a `blocker`, however the reviewer worded it: `should-fix` at most. A cited instruction the file does not hold, or that does not bind the finding's file, is `not-a-problem`. A finding that would be a `blocker` but whose scenario does not hold is `not-a-problem`, not a lower level. "Out of the Change's scope" means code or behaviour the Change does not touch; an improvement to what the Change touches that no scenario asks for is `nice-to-have`.

Then set it:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings level <log> <id> <level> --reason "<one sentence: why this level, citing the scenario, the rule or the guard>"
```

Done when every finding of step 1 has a level.

## 4. Write the report

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log> --level unleveled` again: it must list none (a finding added meanwhile is judged as in step 3). Then run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings report <log>`. It writes `review.md` in the round directory, which finishes the round, and prints its path and the counts.

Done when the report exists and counts 0 unleveled.

## 5. Return

Return only the report's path and the counts line it printed, then one line per `blocker`: id and summary.
