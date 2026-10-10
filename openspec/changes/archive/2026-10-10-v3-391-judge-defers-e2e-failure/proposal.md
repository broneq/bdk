# Proposal

## Why

Tracks #391.

In the #260 measurement (Change `v3-260-measure-run-multi-change-queue`, design "Measurement", Change `4-category-spending-report` on the `ledger` CLI) `proposal.md:13` promised that `ledger report` refuses a broken book (`cannot read ledger.json`, exit 2), while the delta said so only for a file that "cannot be read or is not a JSON array". Round 1's E2E tester failed two break paths (`[{"amount":"x"}]` printed `NaN.NaN` with exit 0; `[null]` crashed with a stack trace). `/bdk:judge` levelled both `nice-to-have` ("malformed entries are unspecified"), auto triage deferred them, the round ended `done`, and `/bdk:close`'s spec check then failed them as `Must address` (problem 2, "E2E failure": every E2E path with `Result: fail` breaks a promise of the proposal). The queue stopped at close of its last Change, against #265 design D1: close fails only on what changed after the last round.

The judge's level table has no line for an `e2e-check` finding, so the judge levels it by the deltas alone and reads a delta narrower than the proposal as leave to break the promise.

## What Changes

- `judge`: an `e2e-check` finding that holds (the code gives what the tester observed) is a `blocker`, also when the deltas or the design word the promise more narrowly than its proposal line or leave the input out, and also for a `break` path held to the baseline. It holds or not by the path file under the round's `e2e/` and the code; a finding whose observation the code does not give is `not-a-problem`.
- The two sides now agree in the one direction the measurement showed: a round never defers an E2E failure that close refuses. Close keeps refusing every failed path (spec `bdk-spec-conformance`, unchanged): shipping a broken promise in the PR is worse than a stop.
- New eval case `judge-e2e-failure` on a new shared fixture `tally-broken-ledger.sh`: the proposal promises that `tally total` refuses a broken ledger, the delta says so only for a file that is not JSON or not an array, the design decides `total` does not check each entry, and two `e2e-check` findings of round 1 (`["abc"]` crashes with a stack trace; `[true, 5]` prints `Total: 6.00` with exit 0) must both be levelled `blocker`.

## Resolved here (from "To resolve in the spec")

- A proposal line that promises more than the delta: the code is the side that is wrong while the proposal settles the behaviour, so the round fixes the code (design D2); the next round's spec check then logs the delta that misses the behaviour, which the loop fixes as any `spec-conformance` finding. Narrowing the proposal is a product decision and stays with the user (manual triage), never with the fix pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-blocks`: the `blocker` level covers an `e2e-check` finding that holds; the eval case `judge-e2e-failure`.

## Impact

- `plugins/bdk/skills/judge/SKILL.md` (level table, the `e2e-check` rule, step 2 reads the path file).
- `plugins/bdk/evals/judge-e2e-failure/`, `plugins/bdk/evals/fixtures/tally-broken-ledger.sh`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/findings.md` (the Levels table) and `docs/concepts/stages.md` (the review stage's level summary); Reference regenerated with `pnpm docs:reference`. No diagram draws the level definitions, so none is redrawn.
- No CLI change, no triage change: auto triage already decides `blocker` as `fix` in every round.
- Out of scope: a round and close that disagree on an invalid delta (#374, done); the PR body's deferred findings (#381, done); `/bdk:close` reading the review's decisions on E2E findings (see design D3).
