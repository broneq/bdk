---
name: review-integration
description: 'Reviews a whole BDK Change top down after its group reviews - every spec scenario reached by the product and proven by a test, behaviour no scenario names, and the seams between plan parts (units, fields, empty values, error contracts) - and appends each problem to the round findings log with bdk findings add. Use when a review round or a user asks to check a Change or branch as a whole, whether it does what its spec says, or how its parts fit together.'
argument-hint: "[<round-dir>] [--base <ref>] [--workdir <path>] [--change <path>|none] [--intent <file>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(git diff *) Bash(git log *) Bash(git show *) Bash(git symbolic-ref *) Bash(git rev-parse *) Bash(git -C *) Bash(cd *) Read Grep Glob
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Review a Change as a whole

The group reviewers read the files of one group each. You read the Change from its intent down and find what no single group shows: a scenario the product does not reach, a scenario no test proves, and a contract one part changes that another part uses differently. Append each problem to the round's findings log. You change no file, run no test, linter or build, set no level and start no agent. Run every `bdk` call as the steps write it, `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"` and each argument written out, as the whole Bash command: nothing before or after it, no `cd`, `;`, `&&`, `|` or `echo`, no shell variable. The permission rule allows `bdk` only on its own, so another form can be denied, and a denied call ends the block. The `--workdir` form below is the one exception. Read and list files with Read, Grep and Glob, not through Bash.

If the block above says "BDK not configured: run /bdk:setup", stop and pass that line on. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## Another checkout, Change or intent

A caller that reviews code outside the working directory (`/bdk:pr-review` reviews a pull request in its own worktree) adds up to three inputs. Without them, skip this section.

- `--workdir <path>`: the checkout to review. Give every Read, Grep and Glob call an absolute path under it, and read the Change and the plan parts there too; run git as `git -C <path> <command>` (the host refuses `cd` followed by `git`) and `bdk` as `cd <path> && "${CLAUDE_PLUGIN_ROOT}/bin/bdk" <command>`, one command per call. Never read the same paths in the working directory: that is another commit. The round directory and its log stay where the arguments say.
- `--change <path>`: the Change directory, relative to the work directory (`openspec/changes/archive/2026-10-01-monthly-report` for an archived one), in place of `openspec/changes/<change>/`. `--change none`: the range carries no Change.
- `--intent <file>`: what the author meant (a pull request's title, description and linked issues). Read it whole as the intent in step 2, next to the proposal, or in its place when there is no Change.

## 1. Find the round

With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it. Otherwise use the manual round: `.bdk/runs/manual/review/round-<N>/`, `N` the lowest number whose directory holds no `review.md`; when it holds no `groups.json`, record it with `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" git groups <base> --rounds .bdk/runs/manual/review --record <round-dir>` (add `--plan openspec/changes/<change>/plan/parts` when `openspec/changes/` holds exactly one Change besides `archive/`; `<base>` is the `--base` given, else the branch `git symbolic-ref --short refs/remotes/origin/HEAD` names, else `main`).

Read `groups.json`: `range`, `anchor` and the `integration` group's files. An `anchor` of `kind` `round` makes this a fix round: it reviews only the fixes made since round `anchor.round`. The log is `<round-dir>/findings.jsonl`; run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log>` and keep what the group reviews found, so you do not repeat it. In a fix round, also run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list` on the log of every earlier round (`<round-dir>/../round-<k>/findings.jsonl`, `k` below this round's number) and keep those findings too: each already has a level and a decision, and raising it again would undo that decision. The Change is `openspec/changes/<change>/`, `<change>` being the directory under `.bdk/runs/`.

Done when you know the range, the changed files, the findings so far, and the Change.

## 2. Read the intent

Read `proposal.md`, every file under `specs/` (each requirement and scenario), `design.md`, every file of `plan/parts/`, and the fix parts of earlier rounds (`.bdk/runs/<change>/review/round-*/fixes/parts/*.md`; their tasks name the findings they fix). Without a Change, the intent is the commit subjects of the range (`git log --format=%s <range>`) and what the user said.

Done when you have the list of scenarios, and for each part the contracts it creates or changes (its tasks' `Interface` lines).

## 3. Check scenarios, tests and seams

Read code to confirm or refute each item; do not review files line by line again.

In a fix round, check only the scenarios whose path from the entry point runs through a changed file, and the contracts a changed file defines or uses, each followed to all its users, inside the scope or not. Every other scenario was reviewed in an earlier round and its code did not change; skip it, and skip item 4 for files outside the scope.

Following a contract takes you into files outside the scope. Do not search them for problems, but a problem you see there on the way is still a problem of the Change: append it in step 4 like any other, unless a finding of this round or an earlier one already names it. A defect you saw and did not log never gets a level or a decision, so the stage can end `done` over it, or someone further on acts on a suspicion nobody judged. Start its evidence with `Outside the fix scope:`, so the judge and the user see why a round that reviewed a fix holds it.

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

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" findings list <log>` and check that each id you added is listed with the source `review-integration`. Return only: the number of findings you added, and their ids with summaries, one per line; "no findings" when there were none. Mention no problem that is not in the log: the caller acts on the log, and a problem only your reply names is one nobody levelled.
