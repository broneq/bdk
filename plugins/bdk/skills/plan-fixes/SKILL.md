---
name: plan-fixes
description: 'Plans the fixes of a triaged BDK review round - turns every finding decided fix into fix parts review/round-N/fixes/parts/NN.md in the plan part format (one task per finding, acceptance scenarios from the spec, tests that reproduce each failure), checks them with bdk plan check, and writes fixes/index.md, naming findings that cannot be planned as a fix. Use when a round has fix decisions and needs a fix plan, when asked to plan the fixes of a review, or when /bdk:auto-review reaches the fix pass.'
argument-hint: "[<round-dir> | <change>]"
allowed-tools: Bash(${CLAUDE_PLUGIN_ROOT}/bin/bdk *) Read Write Edit Glob Grep
---

Current BDK configuration of this project:

!`"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show`

Arguments: $ARGUMENTS

# Plan the fixes of a review round

Turn the findings of one round that are decided `fix` into fix parts, so the execute lead builds them like plan parts: tests first, then the fix, then conform. You write only under the round's `fixes/` directory: never code, tests, specs, the Change's plan or a decision. A fix part may change a spec delta of the Change; the implementer does that, not you. Run `bdk` always as `"${CLAUDE_PLUGIN_ROOT}/bin/bdk"`, each command on its own. Read and search with Read, Glob and Grep.

When the block above says `BDK not configured` or `BDK configuration invalid`, write nothing, reply with that line and stop. If it shows the command instead of its output, run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" config show` first.

## 1. Find the round

- With a round directory in the arguments or the request (`.bdk/runs/<change>/review/round-<N>/`), use it. With a Change name, use the highest `.bdk/runs/<change>/review/round-<N>/` that holds `review.md`. The Change is `<change>`, the directory under `.bdk/runs/`.
- The log is `<round-dir>/findings.jsonl`. Run `bdk findings list <log> --json`. When a finding has no level or no decision, write nothing: reply that the round needs the judge or triage first, naming the ids, and stop.
- Run `bdk findings list <log> --decision fix --json`. These are the findings to plan. With none, write `fixes/index.md` with `- None.` under both sections and go to step 6.
- The fixes directory is `<round-dir>/fixes/`. When it holds `index.md` already, the round is planned: reply with its path and stop, unless the user asks to plan again.

Done when you hold the findings to fix, each with its level, place, summary, evidence and level reason.

## 2. Read what each fix must restore

Read the Change: `openspec/changes/<change>/proposal.md`, every `specs/**/spec.md` (list each scenario as `<capability>` / `Requirement: <name>` / `Scenario: <name>`, `<capability>` being the spec's directory under `specs/`) and `design.md`.

For each finding, read the code at its `file` and `line` and trace its evidence: find the cause, the lines a fix changes, and the test file that covers that code (Grep for the function's name in the tests). A finding from `check` names a red check: read its output file under `.bdk/runs/<change>/checks/` to find the failing test and the code behind it. A finding without a file (an E2E start failure, a crash outside every scenario) needs its cause found from the evidence.

A finding that asks for a test ("scenario X has no test") needs one more answer: does the code already do the scenario's THEN? Trace the scenario's WHEN through the code to the output it gives. When it does, the fix only adds a test of **present behaviour**: that test passes at its first run, and the implementer must know it, because every other acceptance test has to fail before any code. When it does not, the finding is a broken behaviour like any other.

A finding whose fix is spec text (source `spec-conformance`, placed on a delta under `openspec/changes/<change>/specs/`) is plannable when the proposal or the design already settles what the text must say: an error message the design gives every command, a scenario the proposal asks for. Its task adds or corrects the requirement or scenario in that delta; read the proposal and the design for the exact behaviour, and the code for what the product does, so the task names both. OpenSpec refuses a requirement without a scenario (`openspec validate --strict` fails, and `/bdk:close` cannot archive the Change), so a task that adds a requirement names at least one `#### Scenario:` for it, with the WHEN and the THEN the code gives: `add the requirement Bad amount under ## ADDED Requirements, with #### Scenario: Amount that is not a number - WHEN tally add abc runs - THEN it prints tally: not an amount: abc to stderr and exits 1`.

A finding is **not plannable** when its fix needs a product decision: the behaviour it would restore or document contradicts another scenario, the proposal or the design, or none of them settles it; or when the code does not show its cause. Note it with the reason; do not plan around it.

Done when every finding has its cause, the files a fix touches (code and test), its scenario if it breaks one or asks for its test (and whether that behaviour is present), or a reason it is not plannable.

## 3. Cut the parts

1. Findings whose fixes touch a common file go into the same part; the rest form parts by file.
2. Keep each part within `plan.part.max-tasks` and `plan.part.max-files` from the configuration (defaults 5 and 10); split a larger set by file.
3. One part: `isolation: shared`. Several parts: no two may share a file, and each is `isolation: worktree`, so they run in one wave.
4. `depends-on: []`: every plan part was built and merged before the review.
5. Ids continue after the highest two-digit id among `openspec/changes/<change>/plan/parts/*.md` and every part `.bdk/runs/<change>/review/round-*/fixes/parts/NN.md` (Glob both; `index.md` is no part). Plan parts `01` to `03` and no earlier fixes give `04`.

Done when each plannable finding is in exactly one part and the parts share no file.

## 4. Write the parts

Write `<round-dir>/fixes/parts/NN.md` in the plan part format, the same an implementer reads for a plan part:

```markdown
---
id: "04"
depends-on: []
isolation: shared
files:
  - src/duration.js
  - src/duration.test.js
---

# Part 04: Fixes of review round 1 in src/duration.js

## Goal

A duration of 90 seconds prints as `1:30`, and the formatter uses descriptive names.

## Acceptance scenarios

- `timer` / Requirement: Show duration / Scenario: Minutes and seconds

## Tasks

1. Fix f-3a1c9e0b7d22: divide the seconds by 60 for the minutes instead of by 100
   - File: src/duration.js, src/duration.test.js
   - Interface: formatDuration(seconds: number): string (unchanged)
   - Verified by: timer / Requirement: Show duration / Scenario: Minutes and seconds; a test in src/duration.test.js that formats 90 and expects `1:30`
2. Fix f-77b0d4c2e915: rename `secs` to `seconds` (BDK-CQ-1)
   - File: src/duration.js
   - Interface: none
   - Verified by: src/duration.test.js passes unchanged
```

- One task per finding; its first line starts `Fix <finding id>:` and says what changes.
- `## Acceptance scenarios`: each scenario a finding breaks, and each scenario a finding asks a test for. A scenario whose behaviour is present (step 2) ends with ` (behaviour present)`: `` - `tally` / Requirement: Total / Scenario: Empty ledger (behaviour present) ``. The implementer then expects its test to pass at the first run; without the suffix it stops, since a test that cannot fail proves nothing about a fix. Without any scenario, write `- None.`
- `Verified by:` for a broken behaviour names a test that reproduces the finding's failure scenario with its exact input and expected result, so the implementer sees it red first; for a test of present behaviour, the scenario and a test with its exact input and expected result, ending `; it passes at its first run, the behaviour is present`, and the task changes no code; for a fix that keeps behaviour (a rename, a rule), the existing tests that must stay green; for a fix of spec text only, `` `openspec validate <change> --strict` passes; the spec check of the next review round ``, with no test. The scenario such a task writes goes into the task, never under the part's `## Acceptance scenarios`: the implementer checks those against the deltas before it edits them, and the new one is not there yet. A spec-text-only part therefore lists `- None.` there, while its delta still gets every scenario the task names. Never a command that spends money, needs credentials or reaches an external system.
- `files` lists every file the tasks change, tests included, as exact repository-relative paths.

Done when every plannable finding has its task.

## 5. Check and index

Run `"${CLAUDE_PLUGIN_ROOT}/bin/bdk" plan check <round-dir>/fixes/parts`. Exit 1 lists problems: fix each in the parts and run it again. Exit 3 is an environment problem: pass it on and stop.

Then write `<round-dir>/fixes/index.md`:

```markdown
# Fixes of review round 1

## Parts
- 04: f-3a1c9e0b7d22, f-77b0d4c2e915

## Not planned
- None.
```

A not-plannable finding is listed under `## Not planned` as `- <id> <file>:<line> <summary>: <reason>; needs <what: /bdk:design <change>, or the user's decision>`.

Done when the check exits 0 and `index.md` names every finding decided `fix` exactly once.

## 6. Reply

Reply with the path of `fixes/index.md`, the parts with their findings, and each not-planned finding with its reason.
