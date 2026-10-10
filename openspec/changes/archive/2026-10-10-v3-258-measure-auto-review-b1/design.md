# Design

## Context

- The review stage (`plugins/bdk/skills/auto-review/`, `review-round/`, `plan-fixes/`, `triage/`, `judge/`): per round one `bdk:lead` runs `review-round` (a `bdk:reviewer` per plan part group, `spec-conformance --round` on an opus `bdk:verifier` and `bdk check run --at review` in parallel, then the opus `bdk:integration-reviewer` and the `bdk:e2e-tester` together, then the `bdk:judge`); triage and `plan-fixes` run in the main thread; a second `bdk:lead` builds the fix parts with `execute-waves --parts`; the next round reviews the fix commits only. Changed since #266 measured it: the integration reviewer no longer waits for the E2E tester (#263), a fix round with only test changes carries the E2E verdict over (#264), spec conformance runs in every round (#265), the E2E tester derives its scenarios from the proposal (#321), workers start in the foreground (#326), and a defect seen outside a fix round's scope is logged (#367).
- Speed on this Change is measured (#266, `v3-208-measure-speed-b1` design "Measurement > Review"): two rounds, 11.6-12.2 min, 7 group reviewers, E2E 85-147 s, integration 114-142 s; round 1 found 3-6 findings, all test gaps or small issues; run 1 let through a real defect (an absolute statement path read under the working directory) that close then caught.
- B1 baseline (`docs/v3-draft1/run-b1/2026-10-07-bdk-v3-findings.md`, "2. Correctness"; `2026-10-06-b1-full-run-report.md`, sections 3 and 7): 4 review rounds, 55 agents (25 group reviewers, 6-8 integration reviewers, runners and fixers); the integration review caught the only product blocker, a seam across parts (rendered configs bypassed `harness/provider.ts`, so no smoke run got its row) that 27 green tasks missed; rounds 3 and 4 held 2 and 1 minor entries; 52 review entries in all.
- The fixture: `household-book-queued.sh` (#243, #266): the Node CLI `ledger` and the Change `add-household-book`, 7 parts, 27 tasks, 62 files, 3 waves, 71 scenarios, with a bare `origin`, the offline `gh` stand-in, `auto` gates and `execution.lead: foreground`.

## Goals / Non-Goals

**Goals:**

- The review stage's correctness on a B1-sized Change: real defects found, real defects missed, false findings.
- Per round: wall time, groups and reviewers, findings by level and source, decisions, fix parts, the fix pass, cost; whether `execution.max-parallel` binds; whether round 2 stays within the fix scope.
- The main thread's context after each round.

**Non-Goals:**

- Fixing what the runs show; each concrete slowness or missed defect class becomes an issue (D5).
- The other stages (#266) and a queue of Changes (#260).

## Decisions

### D1. One build, reviewed several times

`/bdk:execute add-household-book` runs once on the queued state in its own `claude -p` session; the built workspace is then copied for each review run, and each copy runs `claude -p "/bdk:auto-review add-household-book"` in a fresh session. Every run reviews the same code, so a difference between runs comes from the review and the seeds, not from a different build; the fresh session makes the main thread's context per round the review stage's own, not execute's.

Alternative: `/bdk:run` from the queued state, as #266 did - lost: each run would build different code, and the main thread would carry execute's turns into the review, which hides what triage and `plan-fixes` add. Alternative: a committed fixture of the built state - lost: the build is about 2 600 lines that a model wrote; a script holding it is a large file to keep in step with the plan for one measurement, and the copies give the same "same code" property for this task.

### D2. Correctness from two runs: as built, and with seeded defects

- **Run A, as built.** Every finding is judged by hand against the spec deltas and the code: real (a defect or a gap the Change must close) or false (the code meets the spec, or the finding asks for something no spec, design or rule asks). Missed defects: after the run, the built product is audited by hand, every command used against its spec scenarios, plus the edge cases #266 hit (absolute paths, missing arguments); a real defect found there that no round logged is a miss.
- **Run B, seeded.** The same build plus one commit that seeds a known set of defects (D3). Recall is the share of seeds a round logs as a finding at the level the seed deserves; a seed logged lower, or fixed only by chance, is noted.

Run A alone gives false findings but no fair recall: a model-built product holds few defects and an audit by hand finds only what the auditor looks for. Run B alone gives recall on chosen defects only. Together they answer both. Alternative: more runs of each - lost for this task: #266 shows two runs agree within a minute per stage; the seeds measure kinds of defects, not noise, and a class missed once becomes an issue to fix and re-measure with the eval cases of that fix.

### D3. The seeds

Each seed is a defect class B1 or #266 met, placed in a different plan part, with the Change's own tests still passing, so the checks alone do not find it (as in B1, where 27 tasks closed green). The concrete seeds are listed in "Measurement > Seeds"; they are chosen after the build because they edit the code it wrote. A seed a test catches is replaced.

| Class | Met in |
|---|---|
| A seam across parts: two features that each pass their tests disagree on shared data | B1 product blocker (L-dzhorbso) |
| A path read relative to the working directory | #266 run 1 (M3) |
| Behaviour that contradicts a spec scenario, with its test changed to agree | #266 run 1 (M1, M2), #265 |
| A logic bug in one part on a case its tests do not cover | `monthly-report` seeded bugs |
| A spec scenario with no test while the behaviour is right | #266 run 1 and run 2 findings |
| A design decision broken without a test failing | B1 rule violations seen only in review |

### D4. Environment and what is recorded

- Workspaces outside this repository; the plugin built and loaded with `--plugin-dir plugins/bdk`; `CLAUDE_CONFIG_DIR` as exported by the session that runs the measurement (the user's config directory: its global `CLAUDE.md` and one design-system plugin load, which #266's clean `HOME` did not). That configuration defaults to `sonnet`, so the main thread is pinned with `--model claude-opus-5-5`, as #266 ran it; the agents run on the models their files name.
- `claude -p "<command>" --permission-mode auto --output-format stream-json --verbose`, `LEDGER_TODAY=2026-10-08`, the offline `gh` stand-in first on `PATH`.
- Recorded from the stream, the session transcripts (main thread and subagents) and `.bdk/runs/add-household-book/review/`: per round the lead's wall time, the reviewers and their times, the findings log (level, source, decision), `round.md`, the fix parts and the fix pass; per session cost (`total_cost_usd`) and turns; the main thread's context after each round as the input tokens of its next model call (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`).

The numbers are read by a throwaway script in the session's scratch directory, not committed (`CLAUDE.md`, one-off operational work), as #266 did.

### D5. A miss or slowness becomes an issue, not a fix here

For each seed class a run misses, each false-finding pattern, and each step that takes longer than its share for a reason the transcript shows, one issue in milestone `v3.0` with the evidence, its dependencies analysed. This Change changes no skill: a fix measured on one run would rest on one sample, and the task's scope is the measurement.

## Measurement

2026-10-10, Claude Code 2.1.296, as D4 says: main thread `claude-opus-5-5`; lead, group reviewers, E2E tester, judge, implementers and conformers on `claude-sonnet-5-5`; spec-conformance verifier and integration reviewer on `claude-opus-5-5`; `execution.max-parallel` 10 (default), `policy.budgets.review-rounds` 3 (default), `policy.gates.review: auto`.

### The build

`/bdk:execute add-household-book`: 6.0 min (359 s), $2.62, 3 waves, every part on its first attempt, every conform and wave check passing; 62 files, 140 passing tests. Both review runs start from copies of this build.

### Seeds

One commit on top of the build (`refactor(household): tidy book writes, import and messages`), 9 files, `npm test` still green (139 tests):

| Seed | Class (D3) | Part | Change |
|---|---|---|---|
| S1 | seam across parts | 04 (with 03, 06) | `import` pushes `{ ...row, account }` without `category: null`; its CLI test changed to agree. `categorize` (part 03) skips entries whose category is not `null`, and `list --category none` and the JSON export (part 06) miss them, so the import-then-categorize flow silently does nothing |
| S2 | path relative to the working directory | 04 | `import` reads `join(io.cwd, file)`, so `ledger import /tmp/statement.csv` reads `<cwd>/tmp/statement.csv` |
| S3 | spec contradicted, test changed to agree | 05 | `day must be between 1 and 28` instead of the spec's `day must be 1 to 28`, in the code and both tests |
| S4 | logic bug on an untested case | 06 | the CSV export quotes a field holding `"` or `,` but no longer one holding a line break (spec `ledger-views`, "Export") |
| S5 | scenario without a test, behaviour right | 02 | the CLI test of scenario `Same account` and its unit assertion removed; the check stays |
| S6 | design decision broken, no test failing | 01 | `saveBook` writes `ledger.json` in place, not through `<path>.tmp` and a rename (design D1) |

A tie-break bug in the category report was tried first for S4 and dropped: a unit test caught it.

### Run A: the build as it is

One round, `Status: done`; 5.0 min (300 s) and $2.73 for the session.

| Round 1 (lead 275 s) | |
|---|---|
| Scope | base `b545c29` to the build, 62 files, 7 groups + integration |
| Step 3 | 7 group reviewers, 8-22 s (done at 47 s); spec-conformance verifier 133 s (`Verdict: PASS`); `bdk check run --at review` pass |
| Step 4 | integration reviewer 102 s, E2E tester 84 s (`Verdict: PASS`, 24 scenario files), started together at 163 s |
| Judge | 11 s |
| Findings | 2, both from group reviewers, both `nice-to-have`, both deferred by auto triage: `--day` accepts `0x5` and `1e1` (`Number()`), and the budget report's tests miss `left == 0` and an over-budget total |

Both findings are real. The hand audit (an independent opus agent that ran every command against all 71 scenarios, absolute paths, CRLF, quoted CSV, missing arguments, unknown options, broken and version 1 books) found one confirmed defect in the Change's code, the `--day` parsing, which the review had logged; one more in `src/money.js` (an amount past `Number.MAX_SAFE_INTEGER` is stored wrong), which the Change does not touch; and the rule tests living in `test/category-cli.test.js`, where plan part 03 put them. Its other items were judgement calls the spec does not decide (a stack trace on a write error, which design D2 calls a bug that may crash; malformed entries inside a valid book; extra positional arguments). So run A has no false finding and no missed defect in the Change's scope; both defects are `nice-to-have` in weight, and the judge levelled them so.

### Run B: the build with the seeds

Two rounds, `Status: done`; 11.1 min (668 s) and $5.81 for the session.

| | Wall | Workers | Result |
|---|---|---|---|
| Round 1 | 266 s | 7 reviewers 10-16 s (done at 40 s), verifier 117 s (`FAIL`), check run pass; integration 67 s and E2E 105 s (`FAIL`) from 146 s; judge 17 s | 13 findings: 4 blocker, 2 should-fix, 1 nice-to-have, 6 not-a-problem |
| Triage | 10 s | main thread, auto | 6 fix, 1 defer, 6 accept |
| `plan-fixes` | 45 s | main thread | fix parts 08-11 |
| Fix pass | 100 s | one wave: 4 implementers 16-33 s, 4 conformers 9-13 s | all done |
| Round 2 | 220 s | scope = the 9 files of the fix commits, 4 groups; reviewers 7-8 s, verifier 101 s (`PASS`); integration 28 s and E2E 85 s (`PASS`); judge 6 s | 0 findings |

Every seed was logged in round 1:

| Seed | First logged by | Also logged by | Level | Outcome |
|---|---|---|---|---|
| S1 seam | integration reviewer (the test that hid it) and spec-conformance verifier | E2E tester (twice) | blocker, should-fix | fixed (part 11: `category: null`, the test corrected and extended) |
| S2 path | group reviewer p04 | verifier | blocker | fixed (`resolve`, a test with an absolute path) |
| S3 spec message | group reviewer p05 | verifier, E2E tester | blocker | fixed (message and both tests) |
| S4 CSV line break | group reviewer p06 | verifier | blocker | fixed (with a test) |
| S5 missing test | group reviewer p02 | - | nice-to-have | **deferred**: the judge's reason "only a test is missing"; it would reach the pull request untested (#371) |
| S6 atomic write | group reviewer p01 | - | should-fix | fixed (with a test) |

Recall: 6 of 6 seeds logged, 5 of 6 fixed. The 6 `not-a-problem` findings are all repeats across sources (the verifier and the E2E tester re-logging what a reviewer had logged), levelled as repeats by the judge: no false finding. After the run, `npm test` passes (144 tests) and an import from an absolute path works.

Round 2 stayed within the fix scope: its range is round 1's head to the fix merges, its 9 files are exactly those of the fix commits, and its groups are the fix parts. Its E2E tester ran again, as #264 requires when a fix changes product files.

### Against the questions of the issue

- **Wall time per round**: 266-275 s for round 1 of the whole Change, 220 s for a fix round; #266 measured 317-344 s and 169-175 s before #263, #265 and #326. Round 1 is faster although it now runs the verifier; a fix round is slower because the verifier runs again (101 s).
- **`execution.max-parallel`**: does not bind. Step 3 starts at most 8 agents (7 reviewers and the verifier), step 4 two, the fix pass 4 per wave.
- **Where the time goes**: in every round the verifier is the slowest worker of step 3, and step 4 waits for it: 116 s (run A), 106 s (run B round 1), 98 s (run B round 2) of idle integration reviewer and E2E tester, 35-45 % of a round. #265 design D2 put the verifier in step 3 on the assumption that the reviewers and the check run take longer; here the reviewers finish in 8-22 s: #370.
- **Main thread context** (input of its next model call, D4): 31.4k at the start; 36.7k after round 1; 40.2k-44.1k after triage; 68.8k after `plan-fixes` (which reads the specs, code and tests of the findings there: +25k); 70.1k after the fix pass; 71.5k after round 2. A run with no fix ends at 41.9k. Each round adds about 1k; `plan-fixes` is the only large step and stays far below compaction (no compaction in either run).
- **Cost**: $2.73 for a clean one-round review, $5.81 for two rounds with a fix pass of 4 parts.

### Against the B1 baseline and #266

| | B1 (v2 draft) | #266 run 2 | Run A | Run B (seeded) |
|---|---|---|---|---|
| Rounds | 4 | 2 | 1 | 2 |
| Review agents | 55 | not counted | 12 | 28 (incl. fix pass) |
| Review wall time | not measured apart | 11.6 min | 5.0 min | 11.1 min |
| Product blocker across parts | found by the integration reviewer | none present | none present | seeded (S1): found by the integration reviewer and the verifier |
| Missed in-scope defect | - | absolute path (run 1), found at close | none | S5 deferred, not missed |
| Rounds holding only minor entries | rounds 3 and 4 | - | the only round held 2 `nice-to-have`, deferred, no second round | - |

The review stage now finds the defect classes B1 and #266 met: the seam, which in B1 only the integration reviewer saw, is found by two independent blocks; the absolute path, which #266 let through to close, is found by a group reviewer and the verifier. What it does not do yet is fix a missing scenario test (#371), and it spends about 100 s per round waiting on the verifier (#370).

### What the measurement does not say

One build and one run per arm; six seeds chosen by the measurer. The numbers are an order of magnitude and a per-class answer, not a rate: a class found here can still be missed on another Change. Run under the user's configuration directory rather than #266's clean `HOME` (D4).

## Risks / Trade-offs

- [The user's configuration differs from #266's clean `HOME`] -> recorded in D4; the main thread is pinned to the model #266 ran, and the agents' models come from their files either way.
- [Seeds chosen by the measurer may be easier or harder than real defects] -> each seed is a class B1 or #266 met (D3), and run A measures the review on unseeded code.
- [One run of each] -> the report names the sample size; a missed class is an issue, re-measured by the eval cases of its fix.
