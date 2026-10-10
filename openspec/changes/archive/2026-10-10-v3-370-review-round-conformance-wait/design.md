# Design

## Context

See proposal.md - Why. The round lead (`bdk:lead` on `review-round`) starts workers only as foreground Agent calls (#326, `review-round` step 3: a background worker reports to nobody and leaves the lead polling). Foreground calls sent in one assistant message run in parallel, and the lead gets their results only when every call of that message has returned. So a step is one message, and the next step starts when the slowest worker of the previous one ends: the order of the workers across messages is the only lever on the round's wall time.

Timings of the three paths on the B1-sized Change (`v3-258-measure-auto-review-b1`, "Measurement"): group reviewers 8-22 s (all done at 40-47 s of the lead, including scope and setup), check run ended with them; verifier 101-133 s; integration reviewer 28-102 s; E2E tester 84-105 s; judge 6-17 s. The integration reviewer reads the group findings (`review-integration` step 1); the E2E tester must not overlap the check run (#263, both use the machine); the verifier reads the diff, the specs and the design, not the group findings and not the E2E results (`v3-265` D3).

## Goals / Non-Goals

**Goals:**

- No step of a round waits on a worker whose output it does not read.
- Keep every worker in the foreground and every step one message.

**Non-Goals:**

- Making the verifier itself faster or cheaper (#368 measures its extra time per fix round).
- Changing what the verifier, the integration reviewer or the judge checks.

## Decisions

### D1. The verifier starts in step 4, with the integration reviewer and the E2E tester

Step 3 starts the group reviewers and the check run; step 4 starts the verifier, the integration reviewer and the E2E tester in one message. The round's wall time becomes `max(reviewers, check run) + max(verifier, integration, E2E) + judge`. On run A of #258: about 47 + 133 + 11 = 191 s instead of 275 s; run B round 1 about 40 + 117 + 17 = 174 s instead of 266 s; round 2 about 22 + 101 + 6 instead of 220 s. That is close to the ideal (the longest of the three paths: groups then integration 47 + 102 = 149 s on run A), and it still holds when the check run of another project is the slow part of step 3: the verifier then overlaps the integration reviewer and the E2E tester, not the check run, which costs at most the verifier's lead over the other two step-4 workers.

Resolves the issue's first question: the integration reviewer does not see the verifier's findings before it starts; the judge deduplicates. In run B round 1, 6 of 13 findings were repeats across sources, levelled `not-a-problem` by the judge with no false finding, so one more source of repeats costs a few judge seconds and no correctness. The integration reviewer's question (scenarios against the product, contracts between parts) differs from the verifier's (the spec text read alone against the product), so their overlap is a share of their findings, not all of them.

Resolves the second question: the E2E tester starts when the check run has ended (step 3), as before (#263), and overlaps the verifier, which runs nothing on the machine.

- Alternative: the verifier in the background (`run_in_background: true`) from step 3, collected before the judge - lost: #326 measured that a background worker leaves the lead polling its output file for minutes, and the lead's only way to wait for it is a task notification it may not receive while it keeps working; the foreground rule is what made rounds reliable. It would gain only the reviewers' 10-47 s over D1.
- Alternative: keep the verifier in step 3 and move the E2E tester into step 3 after the check run - lost: one message cannot start a worker after another of the same message ends; it needs the background route above.
- Alternative: keep step 3 as is and start the integration reviewer and the E2E tester in step 3 too, the integration reviewer reading the group findings as they arrive - lost: the integration reviewer would start before the group findings exist, and the E2E tester would compete with the check run (#263).
- Alternative (`v3-265` D2, the current order): lost on the measurement above; its premise, that the reviewers and the check run take longer than the verifier, is false on the B1-sized Change.

### D2. Batch order: the verifier first in step 4

With `execution.max-parallel` below the number of step-4 workers (at most 3, so only at 1 or 2), the verifier goes in the first batch: it is the longest worker of step 4 in every measured round, so starting it first keeps the batch total lowest. Step 3's batches now hold only reviewers, the check run with the first batch.

### D3. Eval graders: keep the four, add `verifier-with-integration`

`integration-with-e2e` (#263), `verifier-in-round`, `conformance-written` and `workers-foreground` (#265, #326) stay true under the new order. One trace regex grader `verifier-with-integration` checks that the verifier's Agent call and the integration reviewer's share one assistant message id, as `integration-with-e2e` does for the integration reviewer and the E2E tester. With both, the three step-4 workers are in one message, which also proves the verifier is not in step 3 (the integration reviewer starts only after the reviewers). It is red on the current skill (the verifier is in the reviewers' message).

- Alternative: a `tool_order` grader "verifier after every reviewer" - lost: it would pass a verifier started after step 4 too, which is the slower order; the same-message check is the one the acceptance signal asks for.

### D4. Acceptance on the B1-sized Change: one run A

The issue's acceptance also asks for the round timing of one B1-sized run. Run A of #258 (the build as it is, one round, $2.73) is re-run on a copy of #258's built workspace (`snapshot-built`) with this branch's plugin, and the step-4 start is read from the transcript with the same timing reading as #258. Run B (seeded, two rounds, $5.81) adds no evidence about the order: the order is the same in every round.

### D5. The round diagram becomes a flowchart

The `/bdk:review-round` diagram of `docs/concepts/orchestrators.md` was a sequence diagram whose second participant held the reviewers and the verifier. With the verifier its own participant next to the integration reviewer and the E2E tester, six participants draw 735 px wide, above the 717 px the `docs:diagram-fit` check allows at 0.8 scale, whatever the message labels. A top-down flowchart with one box per step (step 3 and step 4 as subgraphs) fits and shows the two parallel steps as what they are.

- Alternative: keep the sequence diagram and merge two participants (the verifier with the integration reviewer, or the judge with the reviewers) - lost: one lifeline for two agents of different steps says something false about who runs when.



- [More repeated findings for the judge] -> The judge's repeat rule exists and held in run B (6 repeats, no false finding); repeats are levelled in the same call.
- [A project whose check run is longer than the verifier] -> Step 3 then ends with the check run; step 4 is as long as before at most, because the verifier now overlaps the integration reviewer and the E2E tester instead of the check run. The round is never slower than with the old order by more than the verifier's lead over the longest other step-4 worker, and on the measured Change it is 80-100 s faster.
- [The integration reviewer repeats a verifier finding and the judge levels the earlier one] -> Either copy carries the level; the judge names the kept id.

## Measurement

2026-10-10.

**Eval** (Claude Code 2.1.292, clean `HOME` and the `git` entry of the eval README's "Host limits", `--ablation none`): `auto-review-first-round` on the skills of `staging/v3` with the new grader copied in scored 0.94, only `verifier-with-integration` red (the verifier was in the reviewers' message); after the change 1.00 in 2 of 2 runs ($2.55), every grader green, `integration-with-e2e`, `verifier-in-round`, `conformance-written` and `workers-foreground` included.

**Run A on the B1-sized Change** (D4; Claude Code 2.1.296, a copy of #258's `snapshot-built`, the main thread on `claude-opus-5-5`, the settings of #258 D4, `--plugin-dir` this branch's `plugins/bdk`). Times in seconds from the session start, read from the session and subagent transcripts as #258 read them:

| Round | Reviewers done | Check run done | Step 4 start | Verifier | Integration | E2E | Judge done | Lead wall | #258 lead wall |
|---|---|---|---|---|---|---|---|---|---|
| 1 (7 groups, 61 files) | 43 | by 43 | 47 | 47-193 (146 s) | 48-164 | 49-137 (`PASS`) | 206 | 203 s | 275 s (run A), 266 s (run B) |
| 2 (fix scope, 1 group) | 326 | 328 | 331 | 331-454 (123 s) | 332-352 | 333-435 (`PASS`) | 461 | 158 s | 220 s (run B round 2) |

Step 4 starts 3-4 s after the end of the work it reads (the reviewers and the check run), the time of one `git rev-parse` call, instead of 98-116 s; a round is 62-72 s shorter (23-28 %), close to D1's estimate, and its wall time is now about step 3 plus the verifier, the longest of the three paths after step 3. The session took 7.9 min (474 s) for two rounds and one fix part; #258 run A ran one round only, because this run's integration reviewer logged the `--day` parsing (`0x1c`, `1e1`) as a scenario break and the judge levelled it `blocker` (in #258 a group reviewer logged it and it was levelled `nice-to-have`), so the round counts differ and the per-round wall time is the comparable number. Neither round shows a repeat between the verifier and the integration reviewer: both verifier runs passed.
