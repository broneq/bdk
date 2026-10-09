# Proposal

## Why

Tracks #290. #280 (PR #289, archived Change `2026-10-09-v3-280-pr-review-verify-new-commits`) built three branches of a `/bdk:pr-review --verify` round that only its skill text and one hand run prove: the force-pushed pull request (design D1: the previous head is not an ancestor, so the whole pull request is reviewed), the verify with no commit since the previous review (D6: no group, no reviewer, the judge alone), and the judge's earlier-of-two rule (D3: a seeded `previous-review` finding is never the repeat of a later one). A regression in any of them goes unnoticed: a judge that levels the seeded finding `not-a-problem` makes the main thread resolve the thread of an unfixed bug.

## What Changes

- Two shared fixtures, built on `monthly-report-pr-reviewed.sh`: `monthly-report-pr-force-pushed.sh` (the pull request squashed into one commit on the merge base and force-pushed) and `monthly-report-pr-verified.sh` (a first verify review recorded at the current head, the parse thread resolved, no commit since).
- Orchestrator case `pr-review-verify-force-push`: `round-1/groups.json` starts at the merge base (holds the Change's proposal) and the posted verify review says the whole pull request was reviewed.
- Orchestrator case `pr-review-verify-no-new-commit`: an empty `groups.json`, no `bdk:reviewer` or `bdk:integration-reviewer` started, a `bdk:judge` that keeps the left report finding `blocker`, and a verify review saying no new commits.
- Block case `judge-previous-repeat`: a seeded `previous-review` finding and a later `review-group` finding of the same unfixed bug; the seeded one is `blocker`, the later one `not-a-problem` naming the seeded id.
- The eval README documents the cases and records the results; the specs `bdk-pr-review` and `review-blocks` name them.

No skill, agent, hook or CLI changes: the three cases pass on the current skills.

## Capabilities

### New Capabilities

### Modified Capabilities
- `bdk-pr-review`: requirement "Eval cases of the PR review" adds the force-push and no-new-commit cases.
- `review-blocks`: requirement "Eval cases of the review blocks" adds `judge-previous-repeat`.

## Impact

- `plugins/bdk/evals/`: two fixtures, three cases, `README.md`.
- `openspec/specs/bdk-pr-review/spec.md`, `openspec/specs/review-blocks/spec.md`.
- No user-visible change (eval cases only, no skill, agent, hook, command or setting): no Guide or Concepts page changes; the PR body says `Docs-impact: none - eval cases only`.
