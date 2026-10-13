---
name: repair-wave
description: 'Repairs a red wave check of an OpenSpec Change on the bdk:implementer agent, after every part of the wave is committed on the Change branch - reads the red checks and the parts of the wave, finds which part broke which, edits the parts'' files so both parts'' intent holds, runs the wave check again, and writes execute/wave-N.md, leaving the commit to the lead. Use when a wave check (checks/wave-N.json) is red, or when the execute lead hands one over.'
argument-hint: "[<change>] <wave> --base <commit> [--run-dir <path>] [--parts <dir>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(mkdir -p *) Bash(git status *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git rev-parse *) Read Grep Glob Edit Write Agent
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Repair a wave

The parts of a wave run one after another in the main checkout, each green on its own checks, which cover only the files it changed. The wave check runs the `wave` point (the whole suite, a type check) on everything the wave changed, and it is red: a later part broke what an earlier one built (it changed a function an earlier part's test calls, or a format an earlier part reads). Make the files hold what both parts meant, check them, and leave the commit to the lead. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without pipes or `&&`.

When the block above says `BDK not configured` or `BDK configuration invalid`, reply with that line and stop: write nothing. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 0. Run as `bdk:implementer`

This block runs on the `bdk:implementer` agent, whose instructions start with "You are `bdk:implementer`". When you are not that agent (a user typed the command, or another skill invoked this one in the main thread), do not read or edit the code yourself: start the agent with the Agent tool in the foreground (`run_in_background: false`), `subagent_type: "bdk:implementer"`, prompt `Run the skill bdk:repair-wave with the arguments: <the arguments above>`, `model` set to `models.implementer.model` and `effort` set to `models.implementer.effort`, each only when the configuration above sets it. Wait for it, reply with its status line and report path, and stop.

Done when you are `bdk:implementer`, or the agent has answered.

## 1. Find the wave

- Change: the first argument when two positional arguments are given. Without one, take the only directory under `openspec/changes/` other than `archive/`; with none or several, name what you found and stop.
- Wave: the positional number `<n>`. Base: `--base <commit>`, the Change branch's commit before the wave's first part ran (`waves.<n>.base` in the lead's `state.json`). Without either, stop and name what is missing.
- Parts directory: `--parts <dir>` when given (the execute lead passes the fix parts of a review round), else `openspec/changes/<change>/plan/parts/`.
- Run directory: `--run-dir <path>` when given, else `.bdk/runs/<change>/`. Run `mkdir -p <run-dir>/execute`.
- Wave check: `<run-dir>/checks/wave-<n>.json`. When it is missing or its `verdict` is not `fail`, reply `The wave check of wave <n> is not red` and stop: change nothing, write no report.
- Parts of the wave: run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check <parts dir> --json` and take the parts whose `wave` is `<n>`.

Done when you hold the red checks, the wave's parts and the base.

## 2. Find the cause

1. For each red check of `checks/wave-<n>.json`, read its `tail` and its output file: the failing test, the error, the file and line.
2. `git log --oneline <base>..HEAD` and `git diff <base> -- <file>` for the files of the wave's parts: what each part changed, in the order the parts ran.
3. The goal, tasks and acceptance scenarios of each part whose files the error touches, and their scenarios in `openspec/changes/<change>/specs/**/spec.md`.

Done when you can say which change of which part breaks which other part, and what each meant.

## 3. Repair

Edit the files so both parts' intent holds: the newer name, format or interface wins where a part's task decided it, and the other part's code or test follows it. Edit only the `files` of the wave's parts. When the parts contradict each other, so no code can keep both (each part's scenario expects a different result for the same input), change nothing more and go to step 5 with `Status: blocker` and `Kind: conflict`.

Never stage, commit, reset or check out files: the lead commits the repair.

Done when the cause is repaired, or you stopped on a contradiction.

## 4. Check

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" check run <run-dir> wave-<n> --at wave --changed <base>
```

On `fail`, read the output of each red check and repair again within the same files; three runs in all. A verdict still `fail` after the third run is `Kind: other` with the output path as evidence. Never run a test, linter or build command yourself.

Done when the verdict is `pass` or `none`, or you have a blocker.

## 5. Write the report

Write `<run-dir>/execute/wave-<n>.md`, replacing an earlier one:

```markdown
Status: done

## Repaired
- src/report.test.js: part 01 made `balance()` reject an entry without a date, part 02's summary test built undated entries; the test entries now carry dates.

## Checks
- checks/wave-1.json: pass

## Decisions taken without the user
- None.
```

With `Status: blocker`, add before `## Decisions taken without the user`:

```markdown
## Blocker
- Kind: conflict
- Evidence: part 01's scenario expects `balance()` to throw on an undated entry, part 02's scenario expects a summary of undated entries to print `0.00`.
- Proposal: settle undated entries in the design and re-plan part 02.
```

- `Status: done` only when the last check passed or reported `none`.
- `Kind` is `conflict` (the parts contradict) or `other` (checks stay red).
- An empty section holds `- None.`

Done when the report exists and its first line is the status.

## 6. Reply

Reply with two lines: the status line and the report path.
