# Design

## Context

- #260 "Measurement": session 1 of `/bdk:run #1 #2 #3 #4` finished Changes 1 and 2 and stopped at execute of Change 3 (`3-entry-categories`) with a `plan-defect`: 17 scenarios of four MODIFIED requirements, 7 present, none marked; Changes 1 and 2 had one unmarked present scenario each that their implementers let through. Change 4 later stopped at close on #391.
- #382 "Results": `plan-draft` now traces each scenario's WHEN through the code and marks the present ones ` (behaviour present)`; `verify-plan` fails a missing or wrong marker as `Must address`. Measured on `tally-modified.sh` (5 scenarios, 3 present): 1.00 with the text, 0.43 / 0.00 without.
- `implement-part` step 4 (#346): a marked scenario's test must pass at its first run; an unmarked one whose test passes is a `plan-defect` stop.

## Goals / Non-Goals

**Goals:** the #260 queue run unattended through execute of all four Changes; whether any execute stops with `plan-defect`; whether the markers the planner writes match what the implementer finds.

**Non-Goals:** the run loop's decisions (#260 M1-M3), the solo run (#260 D3), close's #391 stop.

## Decisions

### D1. The same queue as #260, rebuilt from its design

Workspace, issues and settings as #260 D1 and D4: the first commit of `household-book.sh` (the `ledger` CLI configured for BDK), a bare `origin`, the offline `gh` stand-in, and four issues (monthly summary; undo the last entry; categories on entries; spending report per category, blocked by 3). #260 kept its workspace script outside the repository (one-off work), so the issue bodies are rewritten from its D1 table in the same template (Goal, Scope, Acceptance signal, Dependencies). Alternative: a new, larger queue - lost: the issue asks whether the same queue now passes, and a different queue would not answer that.

The run names its own Changes and writes its own designs and plans, so the scenario counts differ from #260's 17 / 7. What is compared is the outcome (execute stops or not) and the markers against the implementer's first run, not the counts.

### D2. Sessions as #260 D2: resume after a stop, merge before Change 4

Session 1 runs the queue; a stop that is not the queue's end is resumed with `/bdk:run`, recording its cause. Change 4 waits for Change 3's pull request; the measurer then merges Change 3's branch into `main` on the bare `origin`, sets the stand-in's pull request record to `MERGED` and starts `/bdk:run` again. The session ends at Change 4's close or its stop there: execute is what is measured, and a #391 stop at close is recorded only.

### D3. Environment

As #260 D4: workspaces outside this repository; the plugin built and loaded with `--plugin-dir plugins/bdk`; `CLAUDE_CONFIG_DIR` as exported by the measuring session; main thread `--model claude-opus-5-5`, agents on the models their files name; `claude -p "<command>" --permission-mode auto --output-format stream-json --verbose`, the stand-in first on `PATH`; `.bdk/settings.local.yaml` with `policy.gates.design: auto`, `policy.gates.review: auto`, `policy.questions: decide-and-record`, `execution.lead: foreground`. Numbers are read by a throwaway script in the session's scratch directory, not committed.

### D4. What is recorded

Per Change: execute's outcome (done or the stop and its reason from `.bdk/runs/<change>/execute/`), the scenarios each plan part lists and how many carry ` (behaviour present)`, the design and plan verify rounds, and, from the implementer's report, whether each marked test passed and each unmarked one failed at its first run. Per session: wall time, turns, cost (`total_cost_usd`), how it ended.

### D5. A defect becomes an issue, not a fix here

As #260 D5: each defect outside this task becomes an issue in milestone `v3.0`, its dependencies analysed. This Change changes no skill.

## Measurement

2026-10-10, Claude Code 2.1.296, `staging/v3` at `4591620` (after #389 and #393), as D3 says: main thread `claude-opus-5-5`, agents on the models their files name, `policy.budgets.*` defaults. The run named the Changes `1-monthly-summary`, `2-undo-last-entry`, `3-entry-categories` and `4-category-spending-report` (blocked by 3), as in #260.

### Sessions

| Session | Command | Wall | Turns | Cost | Changes finished | How it ended |
|---|---|---|---|---|---|---|
| 1 | `/bdk:run #1 #2 #3 #4` | 35.8 min | 218 | $15.55 | 3 (PR 1, 2, 3) | queue end: Change 4 waits for PR 3 |
| 2 | `/bdk:run` after PR 3 merged (D2) | 10.2 min | 84 | $4.65 | 1 (PR 4) | queue end: every Change has a pull request |

The queue: 46.0 min and $20.20 over two sessions for four pull requests, against #260's four sessions, 46.4 min and $20.27 for three pull requests and a fourth Change stopped at close. No session needed a resume after a stop.

### Execute per Change

| Change | Scenarios in the plan | Marked present | First test run: marked green / unmarked red | Execute | #260 |
|---|---|---|---|---|---|
| 1 `1-monthly-summary` | 10 | 1 (`Unknown command`) | 1/1, 9/9 | done, 1 attempt | done; 1 present scenario unmarked, let through |
| 2 `2-undo-last-entry` | 8 | 1 | 1/1, 7/7 | done, 1 attempt | done; 1 present scenario unmarked, let through |
| 3 `3-entry-categories` | 18 (four MODIFIED requirements) | 6 | 6/6, 12/12 | done, 1 attempt | stop: `plan-defect`, 17 scenarios, 7 present, none marked |
| 4 `4-category-spending-report` | 13 | 1 | 1/1, 12/12 | done, 1 attempt | done |

Every marker the planner wrote held at the implementer's first run, and no unmarked scenario passed before its code: no `plan-defect`, no retry. Change 3, the Change that stopped in #260, has the same shape (one part, the MODIFIED requirements `Book file`, `Add an entry`, `Balance`, `Commands`) and now carries its six present scenarios (`No book yet`, `Broken book`, `Add an expense`, `Bad amount`, `Balance of two entries`, `Unknown command`) marked; `verify-plan` traced each marker to a line of `bin/ledger.js` or `src/book.js` and passed. Change 4 relists two scenarios of `Commands` that Change 3 added (`Usage names the category option`, `Usage without a command`) unmarked; their tests failed first, as they should, because Change 4 changes the usage line they quote.

Two review rounds (Changes 1 and 3) planned a test-only fix part for a rule the design decided but no scenario held (extra arguments after `month`; a repeated or empty `--category`); its tests passed at their first run, as the fix part said (#346, #373).

### The rest of each Change

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Time (first stage to the next Change) | 12.2 min | 9.7 min | 13.6 min | 9.8 min |
| Main thread context at start | 38.8k | 104.2k | 134.6k | 39.5k (session 2) |
| Design / plan verify | PASS first / PASS first | PASS first / PASS first | PASS first / PASS first | PASS first / PASS first |
| Review | 2 rounds: 1 should-fix fixed, 1 nice-to-have deferred | 1 round, 1 nice-to-have deferred | 2 rounds: 1 should-fix fixed, 1 nice-to-have deferred | 1 round, 1 nice-to-have deferred |
| Close spec conformance | PASS | PASS | PASS | PASS |
| `npm test` on its branch | 26 pass | 18 pass | 27 pass | 43 pass |
| By hand (the issue's acceptance signal) | works | works | works | works |

No session compacted. Change 4's close passed this time: its E2E tester found no failing path, so #391 did not fire; the run predates #391's fix (#397, merged while this Change was open), so its absence here says only that the tester found nothing to fail.

### What the measurement does not say

One queue, one run per Change. The planner's markers held on 9 present scenarios out of 49; a Change whose present behaviour is harder to trace (a scenario satisfied only in part, behaviour spread over files) is covered by #382's rule (D1: not marked) and its block cases, not by this run. `verify-plan`'s report on Change 3 says "the 7 marked scenarios" and "the 11 unmarked" while naming 6 and 12; its traces and its verdict are right, so this is noise in the report text, not a defect, and no issue is opened.

### Result

The acceptance signal of #390 holds: the #260 queue ran through execute of all four Changes with no `plan-defect`, unattended, and ended with four pull requests. No defect outside this task was found, so no issue is opened.
