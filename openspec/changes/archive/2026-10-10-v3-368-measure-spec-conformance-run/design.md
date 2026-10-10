# Design

## Context

- Run 1 of #208 (archived Change `v3-208-measure-speed-b1`, "Measurement", "Close"): on the B1-sized Change, execute and two review rounds passed, then `spec-conformance` at close failed on M1-M3: the spec deltas listed no error for a missing argument, or for a bad amount or date outside `ledger add`, while design D2 and part 01 gave every command `readAmount` and `readDate`; and part 04 read `join(io.cwd, file)`, so `ledger import /tmp/statement.csv` read `<cwd>/tmp/statement.csv`. After the user's fix, close failed again on the fix (M4: the first wording of the missing-argument rule did not match `ledger add`).
- #208 design D6 then corrected the fixture, so every later run (run 2, #263's run) starts from text that close passes, and none of them can show whether the review loop finds M1-M3.
- #265 (archived Change `v3-265-spec-conformance-in-review`) runs `/bdk:spec-conformance --round` as a worker of every review round (D1, D2), has the judge level a holding finding `blocker` (D5) and `plan-fixes` plan a spec-delta fix (D6). Its block cases on `tally-ledger-path.sh` pass; its "Risks" leave the B1-sized run to this issue.

## Goals / Non-Goals

**Goals:**

- One unattended plan-to-PR run on the Change that stopped run 1, recording where the spec findings appear, how they are levelled and fixed, what the verifier costs per round, and the close verdict.
- A fixture state that a later run can repeat without rebuilding it by hand.

**Non-Goals:**

- Fixing what the run shows: a product defect becomes an issue (D4).
- Speed targets (#208), the quality of review findings (#258).

## Decisions

### D1. A fourth fixture state from one patch, not a hand-built workspace

`household-book-uncorrected.sh` runs `household-book-queued.sh`, applies `fixtures/household-book/uncorrected.patch` with `git apply`, folds the result into the planned commit (`--amend`, the commit date the planned state uses) and force-pushes `main` to the workspace's own bare `origin`. The patch is the reverse of #208 D6 on the workspace paths: spec `ledger` "Options", design D2, parts 01 and 04, the design gate back on `verify-2.md`, `verify-3.md` removed, and `plan/verify-1.md` as it was before D6. The free check asserts the defects are present, that the scenarios equal the queued state's, that `bdk plan check` passes, and that the tree is clean with `origin/main` at `main`.

- Alternative: rebuild the workspace by hand from commit `bb963cdb` - lost: the issue asks for a starting point later runs can repeat (a regression run after the next change to the review loop), and steps nobody runs drift (#208 D2).
- Alternative: keep a second copy of the four changed files under `fixtures/household-book/` and copy them over - lost: two copies of 6-7 KB files drift silently when the corrected ones change; a patch that no longer applies fails the build at once, and its hunks show exactly what differs.
- Alternative: string replacements in `node`, as the `plan-draft-household-book-gap` scaffold does - lost: the plan record differs in whole sections, which a replacement list would restate in full.
- Alternative: run `household-book-planned.sh`, patch, then repeat the queued steps - lost: the queued steps would be copied; amending and force-pushing to a remote the script created a second earlier is cheaper and keeps one definition of the queued state.

### D2. Environment: #208 D3, with the session's account

The run follows #208 D3 (clean `HOME` keeping the login keychain, a `PATH` of the stand-in, Homebrew and the system only, the plugin built and loaded with `--plugin-dir`, `LEDGER_TODAY=2026-10-08`, `--permission-mode auto`, the stream saved outside the workspace so the tree stays clean). Two differences, both forced by the host this task runs on:

- `CLAUDE_CONFIG_DIR` stays the one of the session that starts the run (the account it is logged in to). To keep that directory's user settings (an enabled plugin, a `model` of `sonnet`) out of the run, it starts with `--setting-sources project,local`; its global `CLAUDE.md` (style instructions only) still loads.
- `--model claude-opus-5-5` names the main thread's model, which #208 got from the account default, so the two runs compare; the agents run on the models their files name.

### D3. What is recorded

From the stream, the transcripts (main thread and every subagent, under the config directory's project for the workspace) and `.bdk/runs/add-household-book/`:

- per review round: the `spec-conformance` worker's start, end and cost, its report `review/round-N/spec-conformance.md`, the findings of source `spec-conformance` in `findings.jsonl` with the judge's level and triage's decision;
- `plan-fixes`: which findings became fix parts, on which files (spec delta or code), and what went under `## Not planned`;
- the fix pass: each fix part's status and conformer verdict;
- close: `close/spec-conformance.md` and its verdict, the PR in the stand-in;
- stage times and cost per session, as #208 D4 reads them; when a session stops, its cause, and the run resumed with `/bdk:run`.

A throwaway script in the session's scratch directory reads the numbers; it is not committed (one-off measurement, as #208 D3).

### D4. A defect becomes an issue, not a fix here

Each product defect the run shows (a stop the product causes, a finding misplaced or dropped, a fix that close refuses) becomes one issue in milestone `v3.0`, naming its evidence. This Change changes no skill: a fix measured on one run rests on one sample, and the issue's scope is the measurement.

## Risks / Trade-offs

- [One run is one sample; the verifier may miss in one run what it finds in another] -> the report names what each round's verifier read and found, so a miss shows as a miss, not as an average.
- [The run stops before the PR] -> resume with `/bdk:run`, record the stop and its evidence (the issue's acceptance signal allows it), count only machine time.
- [Other agent sessions load the host] -> #208's numbers are an order of magnitude; the load average at the start is recorded with the timings.

## Measurement

2026-10-10, Claude Code 2.1.296, `claude -p "/bdk:run"` as D2 says, on `household-book-uncorrected.sh`: main thread `claude-opus-5-5`; lead, implementers, conformers, group reviewers, E2E tester and judge on `claude-sonnet-5-5`; integration reviewer and every `spec-conformance` verifier on `claude-opus-5-5`. Load average 8.8 at the start (other agent sessions on the host), 3.3 at the end. One run on the B1-sized Change (7 parts, 27 tasks, 62 files, 3 waves).

### Outcome

The run stopped at `/bdk:close` once, on a defect its own review loop introduced. After a one-line fix by hand, `/bdk:run` resumed and opened the PR with `close/spec-conformance.md` reading `Verdict: PASS` (`Closed: M1`).

- **Session 1** (35.2 min, $13.45, 88 turns, no compaction): execute, three review rounds, close `Verdict: FAIL` on one item, M1: the requirement "Shared argument checks" that round 1's fix pass added to the `ledger` delta has no scenario, so `openspec validate add-household-book --strict` fails and archive cannot merge the deltas. The product already did what the requirement says.
- **The fix by hand**, as a user would: one scenario under that requirement (`ledger transfer ten main savings` prints `ledger: not an amount: ten`, exit 2, checked against the product), committed on the Change's branch.
- **Session 2** (3.4 min, $1.39, 33 turns): close, `Verdict: PASS`, archive, push, PR 1 in the stand-in.

Run 1 of #208 stopped on M1-M3 of the Change's own text. All of them were found, fixed and checked inside the review loop this time. The new stop came from the fix of one of them (#373), and the round check saw it but did not fail it (#374).

### The spec-conformance findings

| | Round 1 | Round 2 | Round 3 | Close |
|---|---|---|---|---|
| Verifier wall time (opus) | 196 s | 193 s | 187 s | 187 s (session 1), 141 s (session 2) |
| Verdict | FAIL, 6 Must address | PASS, 5 Should consider | PASS, 6 Should consider | FAIL (M1), then PASS |
| Findings logged (`spec-conformance`) | 6, all levelled `blocker` | 0 | 0 | - |

Round 1, in the order the verifier logged them:

- `f-dc62f336609d` on `src/commands/import.js:19`: `ledger import /tmp/statement.csv` reads `<cwd>/tmp/statement.csv`. This is run 1's M3, the path defect, found through the requirement sentence (#265 D7), not a scenario. Placed on the code.
- `f-37520d4f39a5`, `f-e63852f42203`, `f-4ffe185558e9`, `f-e7c9638bc6a8`: undocumented argument-count errors of `transfer`, `import`, `category add`/`rule add` and `recurring add`. This is run 1's M1 and M4. Placed on the requirement line of each delta.
- `f-4774f0e74a95`: the shared `not an amount` and `invalid date` errors documented for `ledger add` only. This is run 1's M2. Placed on spec `ledger` "Options".

The judge levelled all six `blocker`, each with the reason "close would refuse" or "SHALL broken" (#265 D5). Auto triage decided them `fix`. Round 1 also held 6 findings from the other workers: 4 `should-fix` (fixed) and 2 `nice-to-have` (deferred).

### Triage, plan-fixes and the fix pass

- `plan-fixes` (111 s) cut the 10 findings decided `fix` into fix parts 08-13 in one wave, with nothing under `## Not planned`. Each spec-delta finding became a task on its delta file, `Verified by: the spec check of the next review round`. Part 08 paired the path fix (with a test that imports from an absolute path, red first) with the `import needs a file` delta. Part 11 held only the accounts and categories deltas. It recorded the choice "documented as the code prints them" under `policy.questions: decide-and-record`.
- Part 09 task 2 said: add "Requirement: Shared argument checks" under `## ADDED Requirements`. "Add no scenario". This follows the skill's rule for spec-text fixes ("the task adds no acceptance scenario of its own"), read as a rule about the delta instead of about the part's `## Acceptance scenarios` list (#373).
- The fix pass (160 s): 6 implementers in parallel (20-43 s), 6 conformers (11-18 s), every part `done` on its first attempt.
- Round 2's spec check passed every fix. Its other workers logged 5 test gaps on the newly documented errors: 1 `should-fix` (fix part 14, 75 s) and 4 `nice-to-have` (deferred). The deferral of the 4 is the case of #371.
- The requirement without a scenario passed both later rounds. Rounds 2 and 3 ran `openspec validate --strict`, saw the failure and listed it under `Should consider` (round 3: "archive at close is likely to refuse"). Close listed the same failure under `Must address` (#374).

### What the verifier adds per round

The verifier starts in step 3 with the group reviewers (#265 D2), and step 4 (integration reviewer, E2E tester) starts after all of step 3. On this Change the group reviewers end 8-25 s into the round, so step 4 waits for the verifier:

| Round | Round wall time | Reviewers done | Verifier done | Step 4 start | Verifier cost (estimate) |
|---|---|---|---|---|---|
| 1 | 407 s | 25 s | 196 s | 205 s | about $0.78 |
| 2 | 381 s | 16 s | 193 s | 202 s | about $0.78 |
| 3 | 256 s | 9 s | 188 s | 199 s | about $0.71 |

- **Time:** about 170-185 s of wall time per round. The rounds of #208 run 2 (344 s and 175 s) and #263 (192 s and 228 s) had no verifier. This is the wait #370 already tracks (measured there at 93-116 s on the corrected Change); the numbers are added to it as a comment.
- **Cost:** about $0.7-0.8 per round, or about $2.3 for the three rounds. These are estimates from each verifier's token counts at list prices, since the stream reports cost per model, not per agent.
- **Close:** the close verifier itself (187 s, about $0.97) is unchanged from before #265.

### Stages

| | Session 1 | Session 2 | #208 run 2 (corrected fixture) |
|---|---|---|---|
| Execute | 6.7 min (403 s): waves 01, 02-06, 07 | - | 7.8 min |
| Review | 24.8 min (1490 s), 3 rounds, 2 fix passes | - | 11.6 min, 2 rounds |
| Close | 3.4 min to the stop | 3.4 min (205 s), PR | 3.0 min |
| Cost | $13.45 (opus $7.06, sonnet $6.39) | $1.39 | $7.42 |
| Agents | 60 | 1 verifier | 35 |

Plan-to-PR machine time: 38.6 min (2113 + 205 s), $14.84, with one user fix in between. That is within the 45 min target, though the margin is smaller than in #208's runs: the review now finds and fixes what close used to stop on, and it spends one more round and about 3 min per round on the verifier.

### Product

The PR holds 88 files (2 817 lines added). `npm test` passes 164 tests. Used by hand, the product behaves as the specs now say: `ledger import /tmp/<file>.csv` imports from an absolute path (`Imported 2 entries`, exit 0); `ledger import` with no file prints `ledger: import needs a file`; `ledger transfer 10` prints `ledger: transfer needs an amount, a from and a to account`; `ledger budget set food x` prints `ledger: not an amount: x`, each with exit 2.

### Issues

- #373: `plan-fixes` plans a requirement without a scenario for a spec-text fix (the cause of the stop).
- #374: `spec-conformance` lists a delta that OpenSpec refuses under Should consider in a round, and under Must address at close.
- #375: the PR body leaves out the decisions the review stage took without the user (`close/pr-body.md`: `none`, while `review/result.md` lists two product decisions of `plan-fixes`).
- #370 (open): the verifier wait in every round; these numbers are added to it.

### What the measurement does not say

This is one run. Whether the round verifier finds M1-M3 every time is not measured; this run found all of them in round 1. Rerunning `household-book-uncorrected.sh` after #373 and #374 shows whether the run then reaches the PR without a stop.
