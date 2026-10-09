# Design

## Context

- #263 comes from the #208 measurement (archived Change `v3-208-measure-speed-b1`, design "Measurement", "Review"): `review-round` then ran the group reviewers, the E2E tester and `bdk check run` in one message (step 3) and the integration reviewer alone after them (step 4). The group reviewers finished 57-98 s before the E2E tester in every round, and the integration reviewer, which reads the group findings and not the E2E verdict, waited for it.
- #317 (commit `cf0f9ea0`, merged before this Change) restructured the round for another reason: the checks of the `review` point (whole and slow suites) and the started product must not compete for the same host. Step 3 now runs the group reviewers and `bdk check run --at review`; step 4 runs the E2E tester and the integration reviewer in one message. Its spec (`bdk-auto-review`, "One review round") says so.
- A `bdk:lead` starts workers as foreground `Agent` calls (`bdk-plugin` spec, "run_in_background"; #326): the calls of one message run in parallel, and the lead's next message comes only after all of them return. A worker cannot be started while another call of the same message still runs.

## Goals / Non-Goals

**Goals:**

- The integration reviewer never waits for the E2E tester, written in the skill and the spec, and graded by the orchestrator case.
- The acceptance measurement on the B1-sized fixture: the integration reviewer starts within seconds of the last group reviewer, and the round's wall time against #208's.

**Non-Goals:**

- E2E rerun only for product changes (#264); spec-conformance stops at close (#265).
- Background workers inside the lead: #326 removed them for a reason the measurement does not reopen.

## Decisions

### D1. Keep #317's two steps; do not move the E2E tester into step 3

The issue's Scope reads: step 3 runs the group reviewers, `bdk check run` and the E2E tester in parallel; step 4 starts the integration reviewer after all of them. Written before #317, that would now:

- break #317's rule that the E2E tester never runs next to the check run (the spec says SHALL NOT);
- not reach the issue's goal: with foreground calls, step 4 starts only after every call of step 3 returns, the E2E tester included, so the integration reviewer would again wait for it. That is exactly the #208 shape.

The order the issue asks for in its Goal ("starts the integration reviewer as soon as the group reviewers return, instead of after the E2E check") is what #317's order already gives: the integration reviewer and the E2E tester start in one message right after step 3. The critical path of a round is `max(reviewers, checks) + max(integration, E2E) + judge`, against #208's `max(reviewers, E2E, checks) + integration + judge`.

Alternatives, each lost:

- Step 3 the reviewers alone; step 4 the integration reviewer and the check run; step 5 the E2E tester - the E2E tester then waits for the integration reviewer (opus, 114-142 s on B1): `reviewers + max(integration, checks) + E2E + judge`, longer for every measured value.
- The E2E tester or the check run in the background, joined later - the lead has no way to wait for a background worker but polling its output file or sleeping, which #326 forbids after a lead polled for 9 minutes.
- Starting the integration reviewer with the group reviewers - it reads their findings so it does not repeat them (`review-blocks`, `review-integration`).

The one wait left is the integration reviewer behind a check run slower than every group reviewer. The B1 measurement (below) shows whether it matters; a project whose `review` checks take minutes keeps it, since the check run cannot leave step 3 without running next to the E2E tester or behind it.

### D2. Say it in the skill, list the integration reviewer first

`review-round` step 4 becomes "Integration and E2E": one message, the integration reviewer listed first, and an explicit line that neither starts after the other has returned, with the reason (the integration reviewer reads the group findings, not the E2E verdict). A model that reads "start in one message" may still split the calls when it reads the E2E tester as "the check"; the reason makes the split visibly wrong. Listing it first puts the slower opus worker at the head of the message. The skill's description and opening line follow. This is an edit of four sentences of an existing skill, not a new skill or a rewrite, so it was made by hand and checked by `bdk-skill-kit:skill-check` (`pnpm check`) and the orchestrator case.

### D3. A grader on the same message

`auto-review-first-round` gets the grader `integration-with-e2e`: it fails when the lead's `bdk:integration-reviewer` call is not in the same assistant message as its `bdk:e2e-tester` call. It is a `regex` grader with `target: trace`, so it needs no new grader type and no CLI helper. In the trace (`out/trace.jsonl`, one JSON object per line) each `tool_use` of an assistant message is its own line carrying `message.id`; calls of one message share that id, and a later message has another. The grader therefore matches an `integration-reviewer` line and an `e2e-tester` line with the same `msg_` id, in either order, through a back-reference.

## Measurement

2026-10-09, Claude Code 2.1.295, the method of `v3-208-measure-speed-b1` D3: `household-book-queued.sh` in `/tmp`, a clean `HOME`, `claude -p "/bdk:run" --plugin-dir plugins/bdk --permission-mode auto --output-format stream-json --verbose`, `LEDGER_TODAY=2026-10-08`; main thread on the account default (opus), the agents on the models their files name. Times are seconds from the session start, read from the `tool_use` and `tool_result` timestamps of the stream (a throwaway script, not committed). One run.

| Round 1 | Start | End | Took |
|---|---|---|---|
| 7 group reviewers (one message) | 389-393 | 403-419 | 13-30 s |
| `bdk check run --at review` (same message) | 393 | 420 | 27 s |
| `bdk:integration-reviewer` (opus) | **422** | 547 | 125 s |
| `bdk:e2e-tester` (same message as the integration reviewer) | 423 | 518 | 95 s |
| `bdk:judge` | 549 | 564 | 15 s |
| **Round (lead)** | 378 | 570 | **192 s** |

| Round 2 (fix scope: 1 file) | Start | End | Took |
|---|---|---|---|
| 1 group reviewer, check run | 683-684 | 697-700 | 14-16 s |
| `bdk:integration-reviewer` | **702** | 722 | 20 s |
| `bdk:e2e-tester` | 703 | 873 | 170 s |
| `bdk:judge` | 874 | 888 | 13 s |
| **Round (lead)** | 671 | 899 | **228 s** |

Against the acceptance signal:

- The integration reviewer starts 3 s after the last group reviewer in round 1 (419 to 422) and 5 s after it in round 2 (697 to 702), in the same message as the E2E tester both times; in #208 it started only after the E2E tester, 57-98 s after the last group reviewer.
- Round 1 takes 192 s, against 317 s and 344 s in #208. The integration reviewer (125 s) and the E2E tester (95 s) now overlap fully; in the #208 order the same workers would give about `max(30, 95, 27) + 125 + 15 = 235 s` plus the lead's turns. Part of the rest is #317 and run-to-run latency (fewer findings, a faster E2E tester), so the overlap, not the whole difference, is this Change's.
- Round 2 takes 228 s (#208: 169 s and 175 s): its E2E tester ran all scenarios again for 170 s on a one-file fix and set the round's length, while the integration reviewer (20 s) ran beside it. That is #264, not a wait of the integration reviewer.
- The review stage took 533 s (8.9 min), from the `auto-review` call to triage of round 2, against 729 s and 698 s in #208. Execute took 372 s (6.2 min).
- The `auto-review-*` orchestrator cases pass (Claude Code 2.1.292 as pinned, `--ablation none`, sonnet lead): `auto-review-first-round` 1.00 in 3 of 3 runs with the new grader `integration-with-e2e` (and in one earlier run before it existed), `auto-review-fix-round` 1.00 in 3 of 3; $7.27 for the six graded runs. The grader was also checked offline on a recorded trace: it matches it, and fails on the same trace with the E2E call moved to its own message after the integration reviewer's result, and on one without an integration reviewer.

The run did not reach a pull request: close stopped on `spec-conformance` (`Verdict: FAIL`, a v1 book file with broken entries migrating to `NaN`), the stop #265 tracks. It says nothing about the round; the review rounds ended `Status: done`.

The check run (27 s) ended within a second of the last group reviewer here. A project whose `review` checks run for minutes still holds the integration reviewer behind them (D1); no measurement shows such a project yet.

## Risks / Trade-offs

- [One run is one sample; model latency varies] -> the report gives the start times of the workers, which say whether the integration reviewer waited, independent of how long each worker took.
- [The grader depends on the trace format of `claude plugin eval`] -> it was written against a recorded trace of Claude Code 2.1.292, the version the eval script pins; a format change fails it visibly, not silently.
