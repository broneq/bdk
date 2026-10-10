# Design

## Context

- `/bdk:run` (`plugins/bdk/skills/run/SKILL.md`, #203): one main thread runs a queue of Changes, one at a time, each on its own branch from the base; for each it calls `bdk:propose`, `bdk:design`, `bdk:plan`, `bdk:execute`, `bdk:auto-review` and `bdk:close` with the `Skill` tool, reading the stage from `bdk run status --json` after each. A Change whose blocker in the queue has no merged pull request waits (D7 of #203); a stage that does not reach its end stops the whole queue (D6); every stage ends with "end your turn", and the run text says that this ends the stage, not the run.
- The deferred decisions (architecture `docs/design/2026-10-07-v3-architecture.md`, "Autopilot continuation" and "Risks"): one session for the whole queue, relying on files after a compaction, with "Changes per session and quality per Change are measured, and a drop is the trigger for one session per Change"; the `Stop`/`SubagentStop` hook engine, added "only when measurement shows autopilot runs stopping without a reason"; and #203 D6, "park the stopped Change and go on with the next independent one", lost for v3.0, "revisit with a measured unattended run".
- What exists: one two-Change run from issues in #203 (three sessions, $6.40; the first stop was a real defect, fixed as D6a, the second the account's usage limit); #266 and #258 measured one B1-sized Change from a queued state (plan to PR 22.9 min, $7.42; review 5-11 min).
- The fixture (#243): `household-book.sh` builds the `ledger` Node CLI configured for BDK (`add`, `balance`, spec `ledger`, the `bdk` OpenSpec schema, `npm test`, an E2E `cli` tool) in its first commit, then adds the B1 Change.

## Goals / Non-Goals

**Goals:**

- Per Change of an unattended queue: turns, time, cost, compactions, stops and their cause; per session: Changes finished.
- Every early stop of the loop: the model ended its turn while a stage was ready.
- Whether a stop would have been avoided by parking the Change and going on with the next independent one.
- How quality per Change changes along the queue, and how much context the main thread carries into each Change.
- From that, a decision on the hook engine, on parking and on one session per Change.

**Non-Goals:**

- Building what the decisions call for; each becomes its own issue (D5).
- The speed of single stages (#266) and the review's recall (#258).

## Decisions

### D1. A queue of four Changes from issues on the `ledger` base

The workspace is the first commit of `household-book.sh` (the `ledger` CLI with BDK, no Change), with four issues in the offline `gh` stand-in, written as this project's template writes them (Goal, Scope, Acceptance signal, Dependencies):

| Issue | Title | Blocked by |
|---|---|---|
| 1 | Monthly summary of the ledger (`ledger month <YYYY-MM>`) | - |
| 2 | Undo the last entry (`ledger undo`) | - |
| 3 | Categories on entries (`ledger add --category`, `ledger balance --category`) | - |
| 4 | Spending report per category (`ledger report`) | 3 (native link and a `Blocked by` line) |

The run starts with `claude -p "/bdk:run #1 #2 #3 #4"`: the queue is built by the run itself, every stage from propose to close runs, and nothing is staged by hand. Two independent Changes and one chain of two, as the issue asks.

The Changes are smaller than B1 (one to three plan parts each instead of seven). Four B1-sized Changes from issues would cost about four times #266's plan-to-PR run plus propose and design, and the deferred decisions are about the loop around the stages (session length, stops, the main thread's context), not about the size of one Change, which #266 and #258 measured. Each stage still runs in full, with its agents, so the main thread carries every stage's turns into the next Change.

Alternative: the B1 Change plus three more on its codebase - lost: B1 is staged from a planned state, so its propose, design and plan would not run in the session, and its size would dominate the queue's numbers. Alternative: the `tally` fixtures of the #203 eval cases - lost: their Changes are staged at close, which skips the stages whose turns fill the main thread.

### D2. The chain is continued as a user would

`/bdk:run` never merges (#203 D7), and the stand-in has no `gh pr merge`, so Change 4 waits for Change 3's pull request. Once Change 3 has its pull request, the measurer merges Change 3's branch into `main` on the bare `origin` and sets the stand-in's pull request record to `MERGED`, as a user merging on GitHub would, then starts `claude -p "/bdk:run"` again. That session measures the resume path the architecture names for a waiting Change: a run started again after a merge picks the waiting Change up.

### D3. Quality along the queue: per Change, and one Change run alone

Per Change: the design and plan verify rounds, the review rounds and their findings by level, the close stage's spec-conformance verdict, `npm test` on its branch, and the product used by hand against the issue's acceptance signal and the Change's spec scenarios.

To separate "later in the queue" from "a harder Change", the third Change of session 1 (issue 3, the last one built in that session, carrying the most context) is run again alone, `claude -p "/bdk:run #3"`, in a fresh copy of the same workspace. Its numbers are compared with the same Change in the queue: verify and review rounds, findings, close verdict, cost and the hand check. One extra Change, not a second queue: the question is whether the long context degrades a Change, and the last one built shows it most.

### D4. Environment and what is recorded

- Workspaces outside this repository; the plugin built and loaded with `--plugin-dir plugins/bdk`; `CLAUDE_CONFIG_DIR` as exported by the session that runs the measurement, as #258 ran it; the main thread pinned with `--model claude-opus-5-5`; agents on the models their files name.
- `claude -p "<command>" --permission-mode auto --output-format stream-json --verbose`, the offline `gh` stand-in first on `PATH`; `.bdk/settings.local.yaml` with `policy.gates.design: auto`, `policy.gates.review: auto`, `policy.questions: decide-and-record` and `execution.lead: foreground` (`claude -p` stops a background lead 10 minutes after the main thread's last turn).
- Recorded from the stream, the main thread's transcript and `.bdk/runs/`: per Change the time from its first stage's `Skill` call to its `close/pr.md`, the main thread's turns and cost in that span (the sum of each model call's usage, priced as the session's `total_cost_usd` prices it, plus its agents' cost from their transcripts), the stage times, compactions (`compact_boundary` events), stops and their cause; the main thread's context at the start of each Change as the input tokens of its next model call (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`); per session cost, turns and Changes finished.
- **An early stop** is a session that ends (the `result` event) while `bdk run status` and the run files show a stage of a Change that is neither done nor waiting and whose last stage reached its end. A stop at a stage that did not reach its end (D6 of #203) is a stop with a cause, recorded with that cause.

The numbers are read by a throwaway script in the session's scratch directory, not committed (`CLAUDE.md`, one-off operational work), as #266 and #258 did.

### D5. A defect or a decision's work becomes an issue, not a fix here

For each defect the runs show outside this task (in a stage, the run loop or a fixture) and for each piece of work the decisions call for, one issue in milestone `v3.0`, its dependencies analysed. This Change changes no skill: the scope is the measurement and the decisions it supports.

## Measurement

2026-10-10, Claude Code 2.1.296, as D4 says: main thread `claude-opus-5-5`; agents on the models their files name; `execution.max-parallel` 10, `policy.budgets.*` defaults. The run named the Changes `1-monthly-summary`, `2-undo-last-entry`, `3-entry-categories` and `4-category-spending-report` (blocked by 3), in that order.

### Sessions

| Session | Command | Wall | Turns | Cost | Changes finished | How it ended |
|---|---|---|---|---|---|---|
| 1 | `/bdk:run #1 #2 #3 #4` | 27.6 min | 203 | $12.45 | 2 (PR 1, PR 2) | stop at execute of Change 3: `plan-defect` (#382) |
| 2 | `/bdk:run` | 1.9 min | 17 | $0.71 | 0 | the account's usage limit, inside execute of Change 3 |
| 3 | `/bdk:run` | 4.2 min | 45 | $2.14 | 1 (PR 3) | queue end: Change 4 waits for PR 3 |
| 4 | `/bdk:run` after PR 3 merged (D2) | 12.7 min | 43 | $4.97 | 0 | stop at close of Change 4: spec conformance `FAIL` (#391) |
| solo | `/bdk:run #3` (D3) | 13.0 min | 86 | $4.42 | 1 (PR 1) | queue end |

The queue: 46.4 min of machine time and $20.27 over four sessions for three pull requests and a fourth Change stopped at its last step. Before session 2 the stop was resolved as a user would: the seven scenarios the implementer named were marked ` (behaviour present)` in `plan/parts/01.md`; the run committed the edit with the `commit` block before execute, as #203 D6a says, and the execute lead retried part 01 alone (part 02 stayed done). Change 4's stop was not resolved: close reads the round's E2E verdict, so only another review round can clear it, and the measurement had its answer.

### Per Change

| Change | Sessions | Time | Main turns | Agents | Cost (main + agents) | Context at start -> end | Stops |
|---|---|---|---|---|---|---|---|
| 1 `1-monthly-summary` | 1 | 8.6 min | 44 | 16 | $1.40 + $2.23 = $3.63 | 38.7k -> 87.9k | none |
| 2 `2-undo-last-entry` | 1 | 11.7 min | 49 | 25 | $2.46 + $3.14 = $5.60 | 88.3k -> 147.9k | none |
| 3 `3-entry-categories` | 1, 2, 3 | 6.9 + 1.7 + 4.1 = 12.7 min | 20 + 6 + 25 | 9 + 3 + 9 | $5.23 | 148.3k -> 172.4k (session 1), 36.8k (2), 36.5k -> 59.6k (3) | execute, `plan-defect` (#382) |
| 4 `4-category-spending-report` | 4 | 12.3 min | 45 | 17 | $1.51 + $3.10 = $4.61 | 38.0k -> 90.9k | close, spec conformance `FAIL` (#391) |
| 3 solo `3-categories-on-entries` | solo | 12.6 min | 46 | 16 | $1.57 + $2.54 = $4.10 | 37.4k -> 88.4k | none |

Per Change cost is the model calls between its first stage's `Skill` call and the next Change's, priced per model so that the session's calls sum to its `total_cost_usd` (D4).

Stage times, session 1 (start of each `Skill` call): Change 1 propose 19 s, design 2.6 min, plan 1.4 min, execute 1.3 min, auto-review 1.4 min, close 1.4 min; Change 2 design 2.9 min, plan 1.3 min, execute 1.3 min, auto-review 4.6 min (two rounds, one fix part), close 1.3 min; Change 3 design 3.2 min, plan 2.0 min, execute to the stop 1.6 min. The run's own work between stages (`bdk run status`, branch, `run.json`) is 5-15 s per stage.

No session compacted. The main thread grows by 50-60k tokens per Change (each stage's skill text, its reads and the reports) and starts a new Change with everything of the earlier ones: 38.7k, 88.3k, 148.3k.

### Early stops of the loop

None. Every session ended at a point the skill says to stop: a stage that did not reach its end (sessions 1 and 4), the queue's end with a Change waiting (session 3), or the account's limit (session 2). In 25 stage calls, every stage's "end your turn" was followed by `bdk run status` and the next stage or Change, including across the three Changes of session 1.

### Stops and parking

| Stop | Cause | Other Changes at that moment | Would parking have avoided it? |
|---|---|---|---|
| Execute of Change 3 | `plan-draft` never marks a scenario of a MODIFIED requirement that the code already satisfies; `verify-plan` passes it; the implementer saw 7 such tests pass at once and stopped (#382). The solo run of the same issue had 5 such scenarios and its implementer let them through, as did Changes 1 and 2 for one each. | 1, 2 done; 4 blocked by 3 | No: the only Change left is blocked by the stopped one. |
| Close of Change 4 | Round 1's E2E tester failed two broken-book paths the proposal promises to refuse; the judge levelled them `nice-to-have`, auto triage deferred them; close's spec conformance counts every E2E failure as `Must address` (#391). | all done | No: it is the last Change. |

Both causes are stage defects, not Change-specific trouble: the first hits any Change that modifies an existing requirement, the second any Change whose E2E tester tests a proposal promise the deltas word more narrowly. Parking would have run more Changes into the same causes.

### Quality along the queue

| | 1 | 2 | 3 in queue | 3 solo | 4 |
|---|---|---|---|---|---|
| Design verify | PASS first | PASS first | PASS first | PASS first | PASS second |
| Plan verify | PASS first | PASS first | PASS first (with #382's defect) | PASS first (same defect, let through) | PASS first |
| Review | 1 round, 0 findings | 2 rounds: 2 should-fix fixed, then 0 | 1 round, 0 findings | 1 round, 2 nice-to-have deferred | 1 round, 2 nice-to-have deferred (#391) |
| Close spec conformance | PASS | PASS | PASS | PASS | FAIL (#391) |
| `npm test` | 26 pass | 18 pass | 30 pass | 24 pass | - |
| By hand (acceptance signal, errors, usage) | works | works | works; README names `--category` | works; README does not (its own deferred finding) | stopped before PR |

Change 3 built third in a 148k context is at least as good as the same issue built alone: the same behaviour on every command tried (exact category match, empty and missing names, a repeated option, old books), more tests, and the README finding the solo review deferred is absent. No sign of a drop along the queue.

What does grow is the main thread's cost: its cost per turn is $0.032 for Change 1, $0.050 for Change 2 and $0.062 for Change 3 in session 1, against $0.034 for Change 4 and the solo Change, each in a fresh session (the cache reads of the longer context). The main thread is 30-45 % of a Change's cost, so a third Change in one session costs about $1 more than in a fresh one.

Merging: Changes 1, 2 and 3 each change the usage line and the command switch of `bin/ledger.js` from the same base, so the second and third pull requests to merge conflict there. The run said so in its session 1 report. This is #203's D9 (no stacked branches) working as designed; the user resolves it at merge.

### What the measurement does not say

One queue of four small Changes (one or two plan parts each) and one solo run. A queue of B1-sized Changes adds more per Change to the main thread (#258: triage and `plan-fixes` +25k in one round); at 50-60k per small Change, compaction would come after three or four of them. The usage limit split session 2, which is not a product stop.

## Decisions from the measurement

### M1. The `Stop` hook engine stays deferred

No early stop in four sessions and 25 stage calls; the trigger in the architecture ("a measured pattern of early stops") did not fire. The run loop's text ("A stage's end is not the run's end") holds across three Changes in one session. No issue.

### M2. A stopped Change still stops the queue; no parking

Both stops would have stopped the queue under parking too (a blocked dependent; the last Change), and both came from stage defects that every later Change could hit. Parking would add a state (a parked Change with uncommitted files on its branch, #203 D6) to save nothing here. The work is fixing the two causes (#382, #391), which removes the stops for every Change. Revisit if a later measured queue stops on a Change-specific cause with an independent Change still waiting. No issue.

### M3. One session per queue stays; no session per Change

Quality did not drop along the queue, and no session compacted up to 172k tokens. The cost of the long context is real but small (about $1 for the third Change), and a session per Change would make the user, or a shell loop, restart `/bdk:run` after every pull request, which the queue exists to avoid. In practice a queue already splits into sessions at stops, waits for a merge and usage limits: four sessions here for four Changes. Revisit when a measured queue compacts or a Change's review or close finds more than the same Change alone. No issue.

### Issues opened

- #382 plan-draft never marks scenarios whose behaviour is present, so execute stops a sound plan as a plan-defect (fixed by #389 while this Change was open)
- #391 judge defers an E2E failure that close then refuses, stopping the run at close
