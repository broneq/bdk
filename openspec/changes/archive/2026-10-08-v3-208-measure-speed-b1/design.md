# Design

## Context

- Targets (architecture design, "Product requirements", Speed): on a Change of B1's size (27 tasks, 62 files), execute <= 15 min; approved plan to PR <= 45 min of machine time with `auto` gates, user waits measured apart; rough budget execute 15, two review rounds of about 10 each, close 5. "Stages and units of work": execute time is about the number of waves times the slowest part, so the plan keeps to 2-3 waves.
- Baseline (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "1. Speed"; full report `2026-10-06-b1-full-run-report.md`): execute 47 min for 6 waves, 96 agents for 27 tasks; review 4 rounds, 55 agents; the whole run 11 h, about 3 h machine work; main thread 1 037 turns.
- The fixture (#243): `household-book-planned.sh` holds `add-household-book` with an approved design and a verified plan of 7 parts, 27 tasks, 62 files in 3 waves (`01`, then `02`-`06`, then `07`). It has no `origin` and no `gh`; the README says a plan-to-PR run needs the bare remote and the offline `gh` stand-in that `tally-reviewed.sh` sets up.
- The stages: `/bdk:run` (#203) takes a queue from `.bdk/runs/run.json` and calls `execute` (#200: one `bdk:lead` running `execute-waves`, an implementer and a conformer per part), `auto-review` (#201: review rounds in a `bdk:lead`, triage, fix parts) and `close` (#202: spec conformance, archive, push, PR) in order.
- Host limits (eval README): `claude -p` stops a background agent 10 minutes after the main thread's last turn, so a long lead needs `execution.lead: foreground`; a run inherits the caller's `PATH` and loads the user's `HOME` configuration (plugins, hooks, `CLAUDE.md`).

## Goals / Non-Goals

**Goals:**

- Execute time and plan-to-PR time on the B1-sized Change, against the 15 and 45 minute targets, with the run broken down per stage, per wave and per part, and with turns, agents and cost.
- A setup that #258 and #260 can repeat without redoing it.

**Non-Goals:**

- Making a stage faster; a slowness found becomes an issue (D5).
- Judging the review's findings (#258) or a queue of several Changes (#260).

## Decisions

### D1. One `/bdk:run` session from a queued state

The measured run is `claude -p "/bdk:run"` on a workspace where `run.json` already queues `add-household-book`: the path a user takes from an approved plan to a pull request with `auto` gates, one session, no person in the loop. Stage times come from the transcript (D3).

Alternative: `claude -p "/bdk:execute ..."`, then `/bdk:auto-review`, then `/bdk:close`, each its own session - lost: three cold starts the product does not have, and it measures the stages, not plan-to-PR. Alternative: `claude plugin eval` with an orchestrator case - lost: the eval sandbox refuses broad Bash and local ports, and the e2e tester and the lead need Bash; the issue asks for a manual run.

### D2. A third fixture state, `household-book-queued.sh`

The queued state runs `household-book-planned.sh` and adds, without a commit: a bare `origin` inside `.git/bdk-eval/` holding `main`, the offline `gh` stand-in, `.bdk/runs/run.json` queueing `add-household-book` from an intent (mode `non-interactive`, base `main`), and `.bdk/settings.local.yaml` with both gates `auto`, `policy.questions: decide-and-record` and `execution.lead: foreground`. `.bdk/runs/` and `settings.local.yaml` are in the project's `.gitignore`, so the tree stays clean, which `/bdk:run` checks before it creates the Change's branch. The remote and stand-in follow `tally-reviewed.sh` and `tally-queue.sh`; the `receivepack` setting is kept so the state also works inside an eval sandbox on a Mac.

Settings go into the local layer, not `.bdk/settings.yaml`, so the committed project is the one #243 verified and the PR diff holds only the Change.

`household-book.test.ts` checks the state for free (the spec scenario "Queued state is at execute with a clean tree"); `evals.test.ts` already runs every fixture.

Alternative: setup steps in the README only - lost: #258 and #260 need the same state, and steps nobody runs drift.

### D3. Environment and what is recorded

- A workspace outside this repository (`CLAUDE.md`: never try a BDK skill here), built by the queued fixture.
- A clean `HOME` that keeps the login keychain (eval README, "Host limits"), so none of the user's plugins, hooks or global `CLAUDE.md` loads; `PATH` without other plugins' `bin/`; the plugin built and loaded with `--plugin-dir plugins/bdk`.
- `claude -p "/bdk:run" --permission-mode auto --output-format stream-json --verbose`, the stream saved to a file; the main thread on the account's default model, the agents on the models their files name. `LEDGER_TODAY=2026-10-08` (the fixture's scenarios count from that date).
- When the session stops before the PR, the cause is recorded and `/bdk:run` is started again; machine time is the sum of the sessions.

Recorded, from the stream, the session transcripts under the clean `HOME` (main thread and every subagent) and the run files under `.bdk/runs/add-household-book/`:

- stage boundaries: the time of each stage's `Skill` call and of the next one; plan-to-PR ends when `close/pr.md` is written;
- execute: per wave and per part, the start and end of the implementer and conformer agents, and merges; `execute/state.json` and `result.md`;
- review: per round, wall time, agents, findings by level, fix parts and the fix pass; `review/result.md`;
- close: the verifier, archive, push and PR;
- per session: turns of the main thread, number of agents, cost (`total_cost_usd`), compactions.

The numbers are read by a throwaway script in the session's scratch directory, not committed: a one-off measurement (`CLAUDE.md`, one-off operational work). The method is fixed here so #258 and #260 can repeat it.

### D4. Reading against the targets

- **Execute time**: from the `bdk:execute` `Skill` call to the next stage's `Skill` call. Target 15 min.
- **Plan-to-PR time**: from the start of the first session to `close/pr.md`, minus any time between sessions. Target 45 min.
- Both are compared with B1 (47 min execute; about 3 h machine work), with the budget split of the architecture (execute 15, review about 20, close 5), and with the floor "waves times the slowest part".

### D5. Slowness becomes an issue, not a fix here

For each stage or step that misses its share of the budget for a reason the transcript shows (a wait, a repeated agent, a command that hangs, a round that found nothing), one issue in milestone `v3.0`, phase "6 Diagnostics", naming the evidence. This Change changes no skill: a fix measured on one run would rest on one sample, and the issue scope is the measurement.


### D6. Correct the fixture where the first run showed it was wrong

Run 1 stopped at close on three spec-conformance items, and two of them came from the fixture, not from the run: the spec deltas listed no error for a missing argument, or for a bad amount or date outside `ledger add` (M1, M2), while the design and part 01 gave every command `readAmount` and `readDate`; and part 04 told the implementer to read `join(io.cwd, file)`, so an absolute path broke (M3). Both had passed two `verify-design` rounds and a `verify-plan` round (#243). A fixture that cannot reach a pull request cannot measure plan-to-PR, and #258 and #260 start from it.

The correction: spec `ledger` "Options" states the argument checks every command shares and what a missing positional argument prints; design D2 and part 01 carry the same rule; part 04 reads `resolve(io.cwd, file)`. No scenario is added, so scenario ownership and the part limits stay as #243 checked them. The approval records are replaced by real verifier runs on the corrected files, as the eval README asks: `design/verify-3.md` (`Verdict: PASS`) with `gate.md` naming it, and a new `plan/verify-1.md` (`Verdict: PASS`). The first wording of the missing-argument rule ("prints `<command> needs ...`") was itself wrong: close failed it as M4, because `ledger add` without arguments prints `not an amount: `; the rule now also allows the error of the first failing check.

Alternative: leave the fixture and count the stop - lost: every later run would stop at the same place, and a stop the fixture causes says nothing about the product. Alternative: make spec-conformance less strict - lost: the items are real gaps between spec and product; that no review round finds them earlier is a product issue (#265), not a reason to weaken close.

## Measurement

2026-10-08, Claude Code 2.1.294, `claude -p "/bdk:run"` as D3 says: main thread `claude-opus-5-5` (the account default), lead, implementers, conformers, reviewers, E2E tester and judge on `claude-sonnet-5-5`, integration reviewer and spec-conformance verifier on `claude-opus-5-5`; defaults of `bdk:lead` (`execution.max-parallel: 10`). Two runs on the B1-sized Change (7 parts, 27 tasks, 62 files, 3 waves):

- **Run 1** on the fixture as #243 left it. It stopped at close; the stop was resolved as a user would (spec and code fixed by hand, committed) and `/bdk:run` resumed twice.
- **Run 2** on the corrected fixture (D6), one session, no stop.

### Against the targets

| | Target | Run 1 | Run 2 | B1 |
|---|---|---|---|---|
| Execute | <= 15 min | 7.6 min (459 s) | 7.8 min (470 s) | 47 min |
| Review (`auto-review`, 2 rounds) | about 20 min | 12.2 min (729 s) | 11.6 min (698 s) | 4 rounds, 55 agents |
| Close | about 5 min | 2.2 min to the stop, then 1.5 and 2.6 min (two more sessions) | 3.0 min (181 s) | - |
| **Plan to PR, machine time** | **<= 45 min** | **26.5 min** (1342 + 90 + 156 s) | **22.9 min** (1373 s) | about 3 h machine work |
| User waits | apart | two fixes after close stops | none | 5 h 04 min on one question |
| Cost | - | $9.53 ($7.86 + $0.75 + $0.92) | $7.42 | - |
| Agents | - | 41 + 2 verifiers | 35 | 96 in execute alone |
| Main thread | - | 59 turns, no compaction | 74 turns, no compaction | 1 037 turns, 3 compactions |

Both targets hold in both runs: execute at about half its budget, plan-to-PR at half of 45 min. Each stage starts within 15 s of the previous one's end; the main thread adds 18-24 s before the execute lead starts and about 1 min in review for triage and `plan-fixes` (66 s, 52 s).

### Execute

One `bdk:lead`; per wave an implementer per part, all at once, then a conformer per part, all at once (run 2; run 1 differs by at most 10 s per wave):

| Wave | Parts | Wall | Slowest implementer | Slowest conformer |
|---|---|---|---|---|
| 1 | 01 | 127 s | 94 s | 27 s |
| 2 | 02-06 | 142 s | 83 s (05) | 48 s (06) |
| 3 | 07 | 107 s | 59 s | 43 s |

The waves take 376 s of the lead's 456 s; the other 80 s are the lead's own turns: state, commits and worktree merges between waves (16-27 s each). Every part passed on its first attempt in both runs; 14 part agents, against B1's 96 agents for 27 tasks. The floor "waves times the slowest part" holds: three waves of 1.5-2.5 min.

The conformers of a wave start only after its last implementer: in wave 2, part 06's implementer finished 30 s before part 05's, and its conformer waited for it. Pipelining each part on its own would save up to 30-40 s per wave; execute is well under its target, so this is noted, not filed.

### Review

| | Run 1 | Run 2 |
|---|---|---|
| Round 1 | 317 s: 7 group reviewers (15-37 s), E2E 94 s (71 scenarios, PASS), integration 142 s (opus), judge 20 s; 6 findings: 3 should-fix (fixed), 3 nice-to-have (deferred) | 344 s: 7 reviewers (18-50 s), E2E 147 s (PASS), integration 114 s, judge 26 s; 3 findings: 2 should-fix (fixed), 1 nice-to-have (deferred) |
| Fix pass | 149 s, 3 fix parts (08-10) | 93 s, 1 fix part (08) |
| Round 2 | 169 s, scope the 3 fixed files; E2E 85 s, 0 findings | 175 s, scope the 2 fixed files; E2E 102 s, 0 findings |

Two concrete slownesses, the same in both runs:

- **The integration reviewer waits for the E2E tester it does not read.** The group reviewers finish 57-98 s before the E2E tester in every round; `review-round` starts the integration reviewer only after all of step 3, though it reads the group findings, not the E2E verdict. 1.5-3 min per run: #263.
- **Round 2 re-runs every scenario end to end for test-only fixes.** Every fix of both runs added tests and changed no product file, yet round 2 ran all 71 scenarios again (85 s, 102 s), its longest worker, and found nothing: #264.

### Close

Run 2: `spec-conformance` (opus) 110 s, `Verdict: PASS`, then archive and the `commit` skill, push, PR 1 into `main` (stand-in), 3.0 min in all.

Run 1: spec-conformance failed after 22 min of a run that had passed everything else (M1-M3, see D6): undocumented error messages, and a real defect, `ledger import /tmp/statement.csv` reading `<cwd>/tmp/statement.csv`, that came from the plan and that both review rounds and the E2E tester (relative paths only) missed. After the user's fix the second close failed again on the fix (M4, 90 s); the third passed and opened the PR (156 s). The time is small, but an unattended run stopped for a user at its last stage: #265.

### Product

Both PRs hold 88 files (about 2 650 lines added), `npm test` passes (155 and 151 tests), and the run 2 product works when used by hand (import from an absolute path, transfers, budgets, the category report, the missing-argument errors).

### What the measurement does not say

Two runs on one Change; model latency varies from run to run, so the numbers are an order of magnitude, not a benchmark: the two runs agree within 1 min per stage. The review's findings were not judged for quality here (#258), nor a queue of several Changes (#260).

## Risks / Trade-offs

- [One run is one sample; model latency varies] -> the report gives per-part times and the wave floor, which say whether a miss is structural or noise, and names the sample size.
- [The run stops before the PR (a blocker, a usage limit)] -> resume with `/bdk:run`, record the stop and count only machine time; a stop the product caused is a finding.
- [The clean `HOME` differs from a user's setup] -> it removes the user's plugins and hooks from the timing; the plugin's own `SessionStart` hook still runs.
- [Shared ground: `plugins/bdk/evals/README.md`, `household-book.test.ts`] -> one new fixture paragraph and one test; announced to the other agents.
