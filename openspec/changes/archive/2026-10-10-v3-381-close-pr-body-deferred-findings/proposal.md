# Proposal

## Why

Tracks #381.

`/bdk:auto-review` writes every finding decided `defer` under `## Deferred` of `review/result.md` and says "`/bdk:close` lists them in the pull request"; `docs/concepts/run-state.md` promises the same. `/bdk:close` step 7 gathers no deferred finding, and spec `bdk-close` does not name them, so the person who reviews the pull request never learns what the review knowingly left for later. Found while working on #375.

## What Changes

- `/bdk:close` adds a `Deferred` part to the pull request body: every bullet under `## Deferred` of `.bdk/runs/<change>/review/result.md`, as written (place, summary, level, issue when it has one), in its order, `nice-to-have` deferrals without an issue included. `- None.` and a missing `review/result.md` add no part.
- The close reply names the deferred findings next to the decisions, as in the body.
- A new `close-*` orchestrator case, `close-deferred-findings`, on a reviewed Change whose `review/result.md` defers a `should-fix` finding with an issue and a `nice-to-have` one without, grades both in the PR body.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `bdk-close`: the pull request body and the reply name the review's deferred findings (requirements "Pull request into the base branch" and "Close record").

## Impact

- `plugins/bdk/skills/close/SKILL.md` (step 7 body, step 8 reply).
- `plugins/bdk/evals/close-deferred-findings/` (new case), `plugins/bdk/evals/README.md` (`close-*` paragraph).
- User docs: `docs/concepts/run-state.md` (the `review/result.md` row and the paragraph after the review diagram), `docs/concepts/findings.md` (where a deferred finding ends up; its flow diagram's `defer` node now names the pull request body). The close sequence diagram of `run-state.md` already draws the read of `review/result.md` (#375). The Reference is regenerated.

## Decided without the user

- Every deferred finding goes into the body, `nice-to-have` ones without an issue included, not only a count: the issue left this open ("To resolve in the spec"); design D1 gives the reason.
