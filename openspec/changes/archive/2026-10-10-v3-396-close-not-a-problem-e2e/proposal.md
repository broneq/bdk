# Proposal

## Why

Tracks #396.

`/bdk:spec-conformance` at close makes every E2E path file with `Result: fail` a `Must address` item (problem 2), whatever the review decided on it. Since #391, `/bdk:judge` levels a holding `e2e-check` finding `blocker`, so the loop fixes it; but a finding whose observation the code does not give (a tester error) is levelled `not-a-problem`. Its path file stays `Result: fail`, no finding is left to fix, the review ends `done` without another round, and close then refuses the Change on a failure the review already cleared. That breaks #265 design D1: close fails only on what changed after the last round. Archived Change `v3-391-judge-defers-e2e-failure`, design D3 ("Known gap"), names this case.

## What Changes

- `spec-conformance` at close: a failed path of a review round's E2E verdict whose `e2e-check` findings in that round's log are all levelled `not-a-problem` is not a `Must address` item. The report lists it under `Checked` as cleared by the review, with the finding id and the judge's reason. Every other failed path stays a `Must address` item: no finding, a finding at any other level (a `blocker` the user deferred included), an unleveled one, or a verdict outside a review round (`.bdk/runs/<change>/e2e/`, which no judge levels).
- `close`: when the E2E verdict in the pull request body is `Verdict: FAIL`, the body also names the failed paths the review cleared, from the `E2E:` line of the spec-conformance report, so the reviewer sees what the verdict line alone would hide.
- New eval case `spec-conformance-e2e-cleared`: round 1 of `add-total` holds a `FAIL` verdict with two failed paths, `empty-ledger`, whose finding the judge levelled `not-a-problem` (the code prints `Total: 0.00`, as the delta says), and `boolean-entry`, whose finding is levelled `blocker` and decided `defer`; the report must keep only the `blocker` path under `Must address` and name the cleared one under `Checked`. A second case, `close-e2e-cleared`, runs `/bdk:close` on a reviewed Change whose only failed path the review cleared and must end with the archive and the pull request.

## Resolved here (from "To resolve in the spec")

- Which side changes: close. It reads the review's level of the path's finding (design D1). The round side (a fresh E2E verdict before the review ends) would re-run the whole E2E check for a finding the judge already traced to a tester error, and the tester could make the same error again, so it neither ends the gap nor stays fast.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-spec-conformance`: problem 2 (E2E failure) excludes a failed path of a round verdict whose findings the round's judge levelled `not-a-problem`; such a path is listed under `Checked`.
- `bdk-close`: the pull request body names the cleared paths next to a `FAIL` E2E verdict.

## Impact

- `plugins/bdk/skills/spec-conformance/SKILL.md` (step 2 reads the round's log, step 3 problem 2, step 4 `Checked`), `plugins/bdk/skills/close/SKILL.md` (step 7, the E2E part of the body).
- `plugins/bdk/evals/spec-conformance-e2e-cleared/`, `plugins/bdk/evals/close-e2e-cleared/`, a shared fixture `plugins/bdk/evals/fixtures/tally-e2e-cleared.sh`, `plugins/bdk/evals/README.md`.
- User docs: `docs/concepts/findings.md` (the `blocker` row: close refuses every failed path the review did not clear), `docs/concepts/openspec-changes.md` (what close's spec check compares), `docs/concepts/stages.md` (the close stage's spec check row), `docs/concepts/e2e.md` (who reads the verdict); Reference regenerated with `pnpm docs:reference`. No diagram draws the E2E items of the spec check, so none is redrawn.
- No CLI change: `bdk findings list --json` already prints each finding's level and `levelReason`.
- Out of scope: the judge's rule for a holding `e2e-check` finding (#391, done); the E2E tester itself.
