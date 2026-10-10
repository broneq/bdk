# Proposal

## Why

Tracks #370.

A review round (`plugins/bdk/skills/review-round/`) starts the opus `bdk:verifier` for `spec-conformance --round` in step 3 with the group reviewers and `bdk check run --at review`, and starts the integration reviewer and the E2E tester (step 4) only when all of step 3 has ended. On the B1-sized Change (archived Change `v3-258-measure-auto-review-b1`, design "Measurement") the reviewers end after 8-22 s and the check run shortly after, but the verifier takes 101-133 s, so step 4 waits 98-116 s in every measured round: 35-45 % of a round. `v3-265-spec-conformance-in-review` design D2 placed the verifier in step 3 on the assumption that the reviewers and the check run take longer; on this Change they do not.

## What Changes

- The verifier moves from step 3 to step 4 of `review-round`: step 3 starts the group reviewers and the check run; step 4 starts, in one message, the verifier, the integration reviewer and the E2E tester. The round's wall time becomes about step 3 (the reviewers or the check run, whichever ends last) plus the longest of the three step-4 workers, instead of the verifier plus the longest of the other two.
- The integration reviewer no longer sees the verifier's findings before it starts; a problem both log is a repeat the judge already levels `not-a-problem` (`judge` "Of two findings that repeat each other").
- The verifier still runs in every round, also one with no group, and its batch order under `execution.max-parallel` puts it first in step 4.
- `auto-review-first-round`: a new grader `verifier-with-integration` (the verifier's Agent call is in the same assistant message as the integration reviewer's); `verifier-in-round`, `conformance-written`, `integration-with-e2e` and `workers-foreground` stay.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-auto-review`: Requirement "One review round" (the verifier starts with the integration reviewer and the E2E tester, after the group reviewers and the check run) and Requirement "Eval cases of the review stage" (the new grader).

## Impact

- `plugins/bdk/skills/review-round/SKILL.md` (steps 3 and 4, description), `plugins/bdk/evals/auto-review-first-round/` (grader, description), `plugins/bdk/evals/README.md` (recorded results).
- User docs: `docs/concepts/orchestrators.md` (the `/bdk:review-round` sequence diagram and its prose), `docs/concepts/stages.md` (the Review intro), `docs/concepts/e2e.md` (when the E2E check starts); the Reference regenerated with `pnpm docs:reference`.
- Out of scope: the verifier's extra time per fix round on another starting point (#368); a missing scenario test deferred by triage (#371).
