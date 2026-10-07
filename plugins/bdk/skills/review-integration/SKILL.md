---
name: review-integration
description: 'Reviews a whole BDK Change top down after its group reviews - every spec scenario reached by the product and proven by a test, behaviour no scenario names, and the seams between plan parts (units, fields, empty values, error contracts) - and appends each problem to the round findings log with bdk findings add. Use when a review round or a user asks to check a Change or branch as a whole, whether it does what its spec says, or how its parts fit together.'
argument-hint: "[<round-dir>] [--base <ref>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git symbolic-ref *) Bash(git rev-parse *) Read Grep Glob
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Review a Change as a whole

The group reviewers read the files of one group each. You read the Change from its intent down and find what no single group shows: a scenario the product does not reach, a scenario no test proves, and a contract one part changes that another part uses differently. Append each problem to the round's findings log. You change no file, run no test, linter or build, set no level and start no agent. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without pipes or `&&`.

If the block above says "BDK not configured: run /bdk:setup", stop and pass that line on. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 1. Find the round

With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it. Otherwise use the manual round: `.bdk/runs/manual/review/round-<N>/`, `N` the lowest number whose directory holds no `report.md`; when it holds no `groups.json`, record it with `bdk git groups <base> --rounds .bdk/runs/manual/review --record <round-dir>` (add `--plan openspec/changes/<change>/plan/parts` when `openspec/changes/` holds exactly one Change besides `archive/`; `<base>` is the `--base` given, else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names, else `main`).

Read `groups.json`: `range` and the `integration` group's files. The log is `<round-dir>/findings.jsonl`; run `bdk findings list <log>` and keep what the group reviews found, so you do not repeat it. The Change is `openspec/changes/<change>/`, `<change>` being the directory under `.bdk/runs/`.

Done when you know the range, the changed files, the findings so far, and the Change.

## 2. Read the intent

Read `proposal.md`, every file under `specs/` (each requirement and scenario), `design.md` and every file of `plan/parts/`. Without a Change, the intent is the commit subjects of the range (`git log --format=%s <range>`) and what the user said.

Done when you have the list of scenarios, and for each part the contracts it creates or changes (its tasks' `Interface` lines).

## 3. Check scenarios, tests and seams

Read code to confirm or refute each item; do not review files line by line again.

1. **Scenario to product.** For each scenario, follow it as a user runs it: from the entry point (a command, a route, a page, a configuration key) through the code to the result. Take the scenario's own inputs and compute what the code returns or prints, value by value. A scenario whose result differs, or that no entry point reaches, is a finding.
2. **Scenario to test.** Each scenario has a test that would fail without it, at a level that proves it: a unit test with hand-built input does not prove what a command prints from a file. Name the scenario without such a test.
3. **Seams.** For each contract a part changes (an exported function or type, a field and its unit, empty and null values, sort order, an error or exit code, a configuration key, a file format, a command) find every user in the other parts and in the existing code, and check that both sides agree. Test data that one side builds by hand while the other side produces it is where a disagreement hides.
4. **Outside the plan.** Behaviour no scenario or intent names; changed files no part lists (the `unplanned` group, when it holds code); a part whose files the range does not touch.

Done when every scenario and every changed contract has a verdict.

## 4. Append the findings

One call per problem that is not already in the log:

```
"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings add <log> --source review-integration --file <path> --line <n> --summary "<one line: what is wrong>" --evidence "<failure scenario>"
```

- `--evidence` is the failure scenario: the scenario's input, what the product gives and what the scenario says. For a seam, put the finding where the wrong assumption is, and name the other side in the evidence (`src/parse.js returns cents; src/report.js:14 formats them as currency units`).
- `--line` is where the fix goes. One finding per problem.

Done when every problem has its line in the log.

## 5. Verify and return

Run `bdk findings list <log>` and check that each id you added is listed with the source `review-integration`. Return only: the number of findings you added, and their ids with summaries, one per line; "no findings" when there were none.
