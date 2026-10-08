---
name: resolve-conflict
description: 'Resolves the merge conflict a plan part left when the execute lead merged its branch into the Change branch, on the bdk:implementer agent - reads both sides and the parts that wanted them, edits each conflicted file to keep what both meant, runs the checks of those parts, and writes execute/merge-NN.md, leaving the merge for the lead to commit. Use when merging a part of a Change stopped on conflicts, or when the execute lead hands over a conflicted merge.'
argument-hint: "[<change>] <part-id> [--run-dir <path>] [--parts <dir>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(mkdir -p *) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git rev-parse *) Read Grep Glob Edit Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Resolve a merge conflict

A merge of a part's branch stopped on conflicts. Make each conflicted file hold what both sides meant, check it, and leave the merge open: the lead stages and commits it. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without pipes or `&&`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop: write nothing. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:implementer`

This block runs on the `bdk:implementer` agent, whose instructions start with "You are `bdk:implementer`". When you are not that agent (a user typed the command, or another skill invoked this one in the main thread), do not read or edit the code yourself: start the agent with the Agent tool, `subagent_type: "bdk:implementer"`, prompt `Run the skill bdk:resolve-conflict with the arguments: <the arguments above>`, and `model` set to `models.implementer` when the configuration above sets it. Wait for it, reply with its status line and report path, and stop.

Done when you are `bdk:implementer`, or the agent has answered.

## 1. Find the merge

- Change: the first argument when two are given. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- Parts directory: `--parts <dir>` when given (the execute lead passes the fix parts of a review round), else `openspec/changes/<change>/plan/parts/`.
- Part: the part whose branch is being merged, `<parts dir>/<part-id>.md`. Without a part id, list the parts and stop.
- Run directory: `--run-dir <path>` when given, else `.bdk/runs/<change>/`. Run `mkdir -p <run-dir>/execute`.
- Unmerged files: `git diff --name-only --diff-filter=U`. When it prints nothing, reply `No merge conflict found` and stop: change nothing, write no report.

Done when you hold the part, the run directory and the list of unmerged files.

## 2. Learn what each side meant

1. `git log --oneline -5 HEAD` and `git log --oneline -5 MERGE_HEAD`: what the Change branch already holds, and what the part's branch adds.
2. The parts behind each unmerged file: the part `<part-id>` and every part under the parts directory whose `files` lists that file. Read their goals, tasks and acceptance scenarios, and the scenarios in `openspec/changes/<change>/specs/**/spec.md`.
3. Each unmerged file whole, with its conflict hunks (`<<<<<<<`, `=======`, `>>>>>>>`), and `git diff MERGE_HEAD^1...MERGE_HEAD -- <file>` for what the part changed in it.

Done when you can say, for each hunk, what each side added and why.

## 3. Resolve

Edit each unmerged file so it holds both sides' intent and no conflict marker. Two additions at the same place usually both stay, in part order (the earlier part's first). Keep the style of the file. Edit only the unmerged files.

When the sides contradict each other, so that no file can keep both (the same function returning different values for the same input, one side deleting what the other changed), do not pick a side: leave that file as it is and go to step 5 with `Status: blocker` and `Kind: conflict`, naming both sides. The parts' plan disagrees with itself, and the caller decides.

Never stage, commit, abort or continue the merge, and never run `git checkout --ours|--theirs`: the lead finishes the merge.

Done when no resolved file holds a conflict marker, or you stopped on a contradiction.

## 4. Check

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check run <run-dir> merge-<part-id> --scope <path> --scope <path> ...
```

with every unmerged file and every file of the parts you read in step 2, so each part's tests run on the merged code. On `fail`, read the output file of each red check and fix the cause within the unmerged files; three runs in all. A verdict still `fail` after the third run is `Kind: other` with the output path as evidence. Never run a test, linter or build command yourself.

Done when the verdict is `pass` (or `none`, stated in the report), or you have a blocker.

## 5. Write the report

Write `<run-dir>/execute/merge-<part-id>.md`, replacing an earlier one:

```markdown
Status: done

## Resolved files
- src/routes.js: part 03 added the `/export` route, part 04 the `/import` route, both after `/list`; both kept, `/export` first.

## Checks
- checks/merge-04.json: pass

## Decisions taken without the user
- None.
```

With `Status: blocker`, add before `## Decisions taken without the user`:

```markdown
## Blocker
- Kind: conflict
- Evidence: part 03 makes `parseDate` return UTC, part 04 local time; both callers rely on their side.
- Proposal: settle the time zone in the design and re-plan part 04.
```

- `Status: done` only when no resolved file holds a conflict marker and the last check passed or reported `none`.
- `Kind` is `conflict` (the sides contradict) or `other` (checks stay red).
- An empty section holds `- None.`

Done when the report exists and its first line is the status.

## 6. Reply

Reply with two lines: the status line and the report path.
