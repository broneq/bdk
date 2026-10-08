---
name: diagnose-bug
description: 'Turns a bug report into a fix contract backed by evidence - reproduces the bug on the product as a user would (a tools.e2e item, or the public interface the report names), finds the root cause in the code, and writes a one-part OpenSpec fix Change (proposal, a spec delta with the reproduction as a scenario, design.md with the root cause, plan/parts/01.md) plus debug/diagnosis.md under .bdk/runs. Writes no Change when the bug does not reproduce, and no plan part when the fix is too large for one. Never edits code or tests. Use when asked to diagnose, reproduce or find the cause of a bug, to prepare a fix without making it, or when /bdk:debug reaches the diagnosis.'
argument-hint: "[<bug report> | <issue>] [--name <change>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Bash(openspec *) Bash(gh issue view *) Bash(git status *) Bash(mkdir -p *) Bash(cd *) Bash(curl *) Read Write Edit Glob Grep AskUserQuestion
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Diagnose a bug

Reproduce the reported bug on the product first, then find why it happens, then write the fix as a one-part Change that `/bdk:execute` can build test-first. You write only the fix Change under `openspec/changes/<change>/` and files under `.bdk/runs/<change>/debug/`: never code, tests, main specs or another Change. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own, without `;`, `&&` or pipes. Read and search with Read, Glob and Grep.

When the block above says `BDK not configured: run /bdk:setup` or `BDK configuration invalid`, write nothing, reply with that line and stop. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 1. Read the report

- An issue reference (`#42`, `42`, an issue URL): `gh issue view <ref> --json number,title,body,labels,state,url` (`#42` as `42`). When it fails, quote the error and stop.
- Any other text: the report as the user wrote it.
- The report must hold a symptom you can observe: what the user did and what went wrong. Without one, ask for it (`AskUserQuestion` when available, else in your reply) and write nothing until it comes.

Name the Change: `--name <change>` or a name the user gives; else `fix-<slug>` (two to four kebab-case words of the symptom), from an issue `<number>-fix-<slug>`. When `openspec/changes/<change>/` exists, stop and name it: it is another fix in progress. The run directory `R` is `.bdk/runs/<change>/debug/`; run `mkdir -p` for it.

Done when you hold the symptom (input, action, expected, observed as reported) and the Change name.

## 2. Reproduce as a user

Before you read the code for a cause, make the bug happen on the product.

1. Pick the way in. A `tools.e2e` item of the configuration whose `driver` reaches the symptom (`cli` for a command, `http` for a request, `browser` for a page): start it with its `env` and `start`, wait for `ready` (a URL: `curl -sS -o /dev/null -w '%{http_code}\n' --retry 30 --retry-delay 2 --retry-connrefused <url>`; a command: run it until it exits 0), drive the steps of the report, and stop what you started (`TaskStop`) when done. Without an item, use the closest public interface the report names: the command a user runs, or the exported function called from a one-off `node -e` (or the project's language) script. Say which in the reproduction.
2. Work where the product cannot touch the repository: when it writes files to its working directory (a data file, a cache), run it in a scratch directory `R/scratch/` (`cd <abs R>/scratch && <command>`, with the product's absolute path).
3. Run the steps exactly as reported, then once more with the smallest input that still shows the bug.

Write `R/reproduction.md`:

```markdown
Result: reproduced
Way in: tools.e2e cli (node bin/tally.js)

## Steps
1. `node /abs/project/bin/tally.js add 5` in .bdk/runs/fix-total-crash/debug/scratch -> `Added 5.00`, exit 0
2. `node /abs/project/bin/tally.js total` -> exit 1

## Expected
`Total: 5.00`, exit 0 (spec tally, Requirement: Total)

## Observed
exit 1, stderr `TypeError: total.toFixed is not a function` at bin/tally.js:20
```

The first line is `Result: reproduced` or `Result: not-reproduced`. Expected comes from the main spec when one states it (`openspec/specs/**/spec.md`), else from the report.

When the observed behaviour matches the expected one, the bug did not reproduce: write `R/diagnosis.md` with `Status: not-reproduced` and the steps you ran, create no Change, and go to step 7.

Done when `R/reproduction.md` exists and says `reproduced`, or you stopped at not-reproduced.

## 3. Find the root cause

Follow the evidence from the symptom to its cause: the line the error names or the output comes from, the data it gets, and the caller that produced that data. Read every caller and callee you follow; do not stop at the line that throws when the wrong value comes from elsewhere. Do not guess a cause the code does not show: when nothing explains the observation, write `Status: blocked` with what you read into `R/diagnosis.md` and go to step 7.

Then size the fix: the lines it changes, every reference to each symbol it changes (Grep the code and the tests), and the test file that covers the code (a neighbouring `*.test.*`, or the tests' directory for a new one).

Done when you can name the root cause with its file and line, the files the fix touches, and the test file.

## 4. Decide the fix fits one part

The fix is **too large** when it needs more than `plan.part.max-tasks` tasks or `plan.part.max-files` files (defaults 5 and 10), or a choice between fixes with different behaviour that the user should make (two readings of the expected behaviour, a breaking change of an interface others use). Then write steps 5 and 6 without the plan part, with `Status: too-large`.

Done when you know whether the fix is one part.

## 5. Write the fix Change

Run `openspec new change <change> --schema bdk`. For each artifact run `openspec instructions <artifact> --change <change>`, follow its `<instruction>`, fill its `<template>` without the template's comments, and write the file with Write.

- **proposal.md**: under Why, the bug in one or two sentences, the issue first when there is one (`Tracks #42.`), and the reproduction (`.bdk/runs/<change>/debug/reproduction.md`). What Changes: the fix in a few bullets. Capabilities: the capability whose behaviour is broken, under Modified when a main spec holds it, else under New.
- **Spec delta** `specs/<capability>/spec.md`: it always holds the reproduction as a scenario with its exact input and expected output, so the implementer tests it and the review's E2E check drives it. When a main spec requirement covers the behaviour, copy that requirement whole under `## MODIFIED Requirements` and add the scenario, or keep it unchanged when one of its scenarios already states this exact case. When none does, add the requirement under `## ADDED Requirements`. Never change what the spec promised to fit the code.
- **design.md**: Context with the reproduction (way in, steps, observed); Decisions with D1 the root cause (file and line, the data that goes wrong and where it comes from) and D2 the fix with the alternatives considered; the call sites the fix reaches and why each stays correct; Risks.
- **plan/parts/01.md** (not when too large):

```markdown
---
id: "01"
depends-on: []
isolation: shared
files:
  - bin/tally.js
  - test/tally.test.js
---

# Part 01: Fix of fix-total-crash

## Goal

`tally total` prints the sum after amounts were added.

## Acceptance scenarios

- `tally` / Requirement: Total / Scenario: Total after an add

## Tasks

1. Store the parsed amount in `add` instead of the text it was given
   - File: bin/tally.js, test/tally.test.js
   - Interface: none
   - Verified by: tally / Requirement: Total / Scenario: Total after an add; a test in test/tally.test.js that runs `tally add 5` then `tally total` in a scratch directory and expects `Total: 5.00`, exit 0
```

  Each task changes one thing; the first task's `Verified by:` names the test that reproduces the bug with the reproduction's exact input, so the implementer sees it red before the fix. `files` lists every file the tasks touch, tests included.

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check openspec/changes/<change>/plan/parts`: exit 1 lists problems, fix them and run it again; exit 3 is an environment problem, pass it on and stop. Then `openspec validate <change>`: fix what it reports.

Done when the Change validates and, unless too large, its part passes `bdk plan check`.

## 6. Record the diagnosis

Run `git status --porcelain`. It must list only `openspec/changes/<change>/`: remove anything else the reproduction left in the repository, or name it when you cannot. `R/scratch/` stays: it is under the ignored `.bdk/runs/`.

Write `R/diagnosis.md`:

```markdown
Status: ready
Change: fix-total-crash
Reproduction: .bdk/runs/fix-total-crash/debug/reproduction.md
Root cause: bin/tally.js:15 `add` pushes the text argument, so `total` sums strings and calls toFixed on a string
Scenario: tally / Requirement: Total / Scenario: Total after an add
Part: openspec/changes/fix-total-crash/plan/parts/01.md
Next: /bdk:debug fix-total-crash
```

The first line is `Status: ready`, `too-large` (no `Part:` line; `Next: /bdk:design <change>`), `not-reproduced` (only `Reproduction:` and `Next:` with what would help reproduce it) or `blocked` (`Reason:` instead of `Root cause:`).

Done when `R/diagnosis.md` exists and its first line is the status.

## 7. Reply

Reply in a few lines: the status line; whether and how the bug reproduced; the root cause; the Change and its part, or what is missing; and the next step from `diagnosis.md`. Never say the bug is fixed: nothing is fixed until `/bdk:execute` builds the part.
