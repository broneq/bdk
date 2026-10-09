# Proposal

## Why

Tracks #263.

The #208 measurement (archived Change `v3-208-measure-speed-b1`, design "Measurement", "Review") found that a review round started `bdk:integration-reviewer` only after the E2E tester had returned, although the integration reviewer reads the group findings, not the E2E verdict: on the B1-sized Change the group reviewers finished 57-98 s before the E2E tester in every round, and the integration reviewer (29-142 s) then ran alone. That cost 1.5-3 min of a 22-23 min plan-to-PR run (speed, problem 1 of v3).

Since then #317 (commit `cf0f9ea0`, "run checks at part, wave and review points") moved the E2E tester out of step 3 of `review-round` into step 4, next to the integration reviewer, so that the project's suites (`bdk check run --at review`) and the started product never share the machine. The integration reviewer already starts together with the E2E tester, right after the group reviewers and the check run. What #263 still needs is that this stays so and is proven on the B1-sized fixture: the skill says it only as "start in one message", nothing grades it, and the acceptance measurement has not been taken.

## What Changes

- `review-round` step 4 ("Integration and E2E") starts the integration reviewer and the E2E tester in the same message as soon as step 3 ends, and says why: neither waits for the other, and the integration reviewer reads the group findings, not the E2E verdict. The integration reviewer is listed first. The no-contention rule of #317 (no E2E while the check run runs) stays.
- The `bdk-auto-review` spec says that the integration reviewer never waits for the E2E tester, with a scenario.
- The orchestrator case `auto-review-first-round` gets a grader that fails when the integration reviewer starts only after the E2E tester has returned; its stale description (E2E in parallel with the group reviewers) is corrected.
- The round is measured again on the B1-sized fixture (`household-book-queued.sh`); the result is recorded in design.md and the eval README.
- Not done, as the issue's Scope literally reads: moving the E2E tester into step 3 next to the group reviewers and the check run. #317 decided against it (the full suite and the started product would compete for the same host), and with the integration reviewer already next to the E2E tester it would not shorten the round further (design D1).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-auto-review`: requirement "One review round" says the integration reviewer starts with the E2E tester and never after it has returned; requirement "Eval cases" names the new grader of `auto-review-first-round`.

## Impact

- `plugins/bdk/skills/review-round/SKILL.md` (step 4 and the description).
- `plugins/bdk/evals/auto-review-first-round/` (one grader, the description), `plugins/bdk/evals/README.md` (the grader and the measurement).
- User docs: Concepts page `docs/concepts/orchestrators.md`, section `/bdk:review-round` (its sequence diagram's parallel block and the prose under it); the Reference regenerated (the skill's description).
- Out of scope: E2E rerun only for product changes (#264), spec-conformance stops at close (#265).
