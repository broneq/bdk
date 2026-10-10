# Proposal

## Why

Tracks #375.

With `policy.questions: decide-and-record`, the review stage takes decisions without the user (auto triage, product choices of a fix pass) and `/bdk:auto-review` lists them under `## Decisions taken without the user` of `review/result.md`. `/bdk:close` builds the pull request body only from `proposal.md` and `design.md`, so the PR of #368's measured run (archived Change `v3-368-measure-spec-conformance-run`, design "Measurement", "Issues") read `none` while `review/result.md` held two product decisions. The person who reviews the PR never sees them; only `/bdk:run`'s final reply does.

## What Changes

- `/bdk:close` adds the bullets of `## Decisions taken without the user` of `.bdk/runs/<change>/review/result.md` to the decisions part of the pull request body, all of them (auto triage lines included), grouped by source next to the proposal's and the design's. `- None.` and a missing `review/result.md` add nothing.
- `/bdk:run`'s final report reads every decision of a Change from the decisions part of `close/pr.md` only, which now holds the review stage's too, so no decision is listed twice.
- A new `close-*` orchestrator case, `close-review-decisions`, on a reviewed Change whose `review/result.md` holds an auto triage line and a product decision, grades both in the PR body.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bdk-close`: the pull request body names the review stage's decisions taken without the user (requirement "Pull request into the base branch").
- `bdk-run`: the final report takes the decisions from `close/pr.md` only (requirement "Final report").

## Impact

- `plugins/bdk/skills/close/SKILL.md` (step 7 body, step 8 reply), `plugins/bdk/skills/run/SKILL.md` (step 9).
- `plugins/bdk/evals/close-review-decisions/` (new case), `plugins/bdk/evals/README.md` (`close-*` paragraph).
- User docs: `docs/concepts/run-state.md` (the `review/result.md` row and the paragraph after the review diagram; the close sequence diagram gains the read of `review/result.md`), `docs/concepts/gates-and-budgets.md` (where decisions are recorded and listed). The Reference is regenerated.

## Decided without the user

- Auto triage lines go into the PR body together with product decisions: the issue left this open ("To resolve in the spec"); design D1 gives the reason.
