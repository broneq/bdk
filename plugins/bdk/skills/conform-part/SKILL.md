---
name: conform-part
description: 'Checks the uncommitted diff of one implemented plan part of an OpenSpec Change on the bdk:conformer agent - against the execute rules, the project instructions (CLAUDE.md, AGENTS.md, .claude/rules) and the part''s tasks - fixes each violation it can fix without changing behaviour, leaves the rest, runs the part checks, and writes execute/conform-NN.md. Use when a part is implemented and about to be committed, when asked to clean up or check a part against the rules, or when the execute lead conforms a part.'
argument-hint: "[<change>] <part-id> [--run-dir <path>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(mkdir -p *) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Read Grep Glob Edit Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Conform a part

Check what one implemented part changed against the rules, the project instructions and the part's tasks. Fix what you can fix without changing behaviour; leave the rest, with evidence. You never fix a bug, never add a feature or a test of new behaviour, and never edit outside the part. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without pipes or `&&`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop: write nothing. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:conformer`

This block runs on the `bdk:conformer` agent, whose instructions start with "You are `bdk:conformer`". The conversation that wrote the code must not conform it. When you are not that agent (a user typed the command, or another skill invoked this one in the main thread), do not read or edit the code yourself: start the agent with the Agent tool, `subagent_type: "bdk:conformer"`, prompt `Run the skill bdk:conform-part with the arguments: <the arguments above>`, and `model` set to `models.conformer` when the configuration above sets it. Wait for it, reply with its verdict line and report path, and stop.

Done when you are `bdk:conformer`, or the agent has answered.

## 1. Find the part, the run directory and the implementer report

- Change: the first argument when two are given. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- Part: `openspec/changes/<change>/plan/parts/<part-id>.md`. Without a part id, or when the file is missing, list the parts there and stop.
- Run directory: `--run-dir <path>` when given, else `.bdk/runs/<change>/`. Run `mkdir -p <run-dir>/execute`.
- Implementer report: `<run-dir>/execute/part-<part-id>.md`. When it is missing or its first line is not `Status: done`, write the report of step 6 with `Verdict: FAIL` and one `Left` item naming that, change nothing, and reply.

Done when you know the part, the run directory, and that the part was implemented.

## 2. Find the diff

The implementer does not commit; the lead commits after you. The part's work is the working tree against `HEAD`:

1. `git status --porcelain` for changed and untracked paths. Keep those in the part's `files`. A changed path outside `files` goes to `Left` as `outside the part`, unread and unedited.
2. `git diff HEAD -- <path>` for each tracked path; read each untracked path whole.

Done when you have every changed line of the part.

## 3. Read what binds the diff

1. The part whole: `files`, goal, acceptance scenarios, and each task's `File`, `Interface` and `Verified by` lines.
2. The rules: `bdk rules for --stage execute --files <path> --files <path> ...` with every changed path of the part.
3. The project instructions: `CLAUDE.md` and `AGENTS.md` in the project root and in each directory on the way to a changed path, and each `.claude/rules/*.md` whose `paths` match one.
4. The spec scenarios the tasks are verified by, in `openspec/changes/<change>/specs/**/spec.md`, and the requirement text around them.

Judge from the code. What the implementer report says it did is a claim, not evidence.

Done when you have the list of rules, instructions and tasks to check each line against.

## 4. Check each changed line

Against three sources:

1. **Rules.** Each rule from step 3 that a changed line breaks. Cite it by its id (`BDK-CQ-4`).
2. **Project instructions.** Each instruction a changed line breaks. Cite the file (`CLAUDE.md`).
3. **Tasks.** For each task: its files hold the change; its `Interface` holds as written - the name, the signature, exported or private; its `Verified by` test exists; and the code does what the task and its requirement text say. Cite it as `task <n>`.

Leave formatting and anything a linter checks to the linter.

Done when every changed line was checked against all three.

## 5. Fix or leave

Fix a violation when the fix keeps behaviour unchanged: every input gives the same output, every caller still works, every test that passed still passes. Such fixes: a name, a comment, an import path that resolves to the same module, visibility a task declares, dead code, a duplicated helper replaced by the existing one. Edit only the part's `files`.

Leave a violation, with the file and line, its source and why you left it, when the fix would:

- change what a user or a caller sees, including a bug fix or a missing behaviour - you never fix a bug: it would land without a test or a review that traced it;
- add a feature, or a test of new behaviour;
- touch a file outside the part's `files`.

Example: a task asks that a title be trimmed, and the code does not trim it. Trimming changes the output: leave it as `task 2` with the line, not fixed.

Then run the checks, changed files or not:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check run <run-dir> conform-<part-id> --scope <path> --scope <path> ...
```

with every path of `files`. When a check is red after your fixes, your fix broke it: undo that fix by editing it back, move the item to `Left`, and run again.

Done when each violation is fixed or left, and the checks ran after the last fix.

## 6. Write the report

Write `<run-dir>/execute/conform-<part-id>.md`, replacing an earlier one:

```markdown
Verdict: FAIL

## Fixed
- src/export.js:3 BDK-CQ-4: removed the comment narrating the change.
- test/export.test.js:2 CLAUDE.md: `import fs from "fs"` now `node:fs`.

## Left
- src/export.js:14 task 2: titles are not trimmed, as the task asks; trimming changes the output, so it was not fixed.

## Checks
- checks/conform-03.json: pass
```

- `Verdict: FAIL` if and only if the check verdict is `fail`, a `Left` item names a task, or the implementer report was missing or not done. A rule or an instruction left does not fail the part by itself: the review reads `Left`.
- An empty section holds `- None.`

Done when the report exists and its first line is the verdict.

## 7. Reply

Reply with two lines: the verdict line and the report path.
