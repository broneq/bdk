---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/evals/pr-review-verify
  - plugins/bdk/evals/pr-review-verify-force-push
  - plugins/bdk/evals/pr-review-verify-no-new-commit
  - plugins/bdk/evals/pr-review-verify-regression
  - tests/eval-suites.test.ts
---

# ADR-0017: The PR-review record lives on GitHub, in hidden markers of the user's own review

## Context and Problem Statement

`/bdk:pr-review --verify <pr>` re-checks a review the user posted earlier: which findings the new commits fixed, which are left, and what the new commits broke. To do that it needs the previous review's findings, their threads and the head commit it reviewed. BDK writes every round to `.bdk/runs/pr-<N>/`, but that directory is outside git, lives on one machine and may be cleaned; a teammate or another machine never has it. Where does the verification read the previous review from?

## Decision Drivers

- **Works anywhere:** on another machine, after the run directory is gone, after a force-push.
- **Other reviewers' feedback stays visible:** BDK must not resolve or hide threads it did not open.
- **Nothing posted without the user** (the review is confirmed before it reaches GitHub).

## Considered Options

1. **Markers on GitHub:** the previous review is read from the user's own posted review and threads, recognised by hidden markers.
2. **Local run files:** the previous round's files under `.bdk/runs/pr-<N>/`.
3. **Every open thread on the pull request**, whoever opened it.

## Decision Outcome

**Chosen option: 1.** Every review BDK posts carries hidden markers: the summary ends with `bdk-pr-review v3 kind=summary` (or `kind=verify-summary`) with the verdict and `head=<sha>`, and each inline finding with `kind=finding`. `--verify` reads, in one `gh api graphql` query, the newest review of the current user (`gh api user`) holding a summary marker, its unresolved threads whose first comment is that user's and holds a finding marker (levels `blocker` and `should-fix`), and the findings outside the diff from that review's own sections. The `head=` value sets the range to review: the commits since that head, or the whole pull request when the head is no longer an ancestor (a force-push) or unknown. Local `pr-<N>/` rounds are never read for this. Only the user's own threads are resolved, each one whose finding the judge now levels `not-a-problem`, and only after the verify review is posted.

It is the only option that works across machines and cleaned runs and never touches another reviewer's open feedback.

### Consequences

- ✅ Verification works from any checkout, also after a force-push.
- ✅ Other reviewers' threads are never read as BDK findings and never resolved.
- ❌ The marker format is a contract with reviews already posted on GitHub: changing it makes those reviews unverifiable.
- ❌ BDK parses comment bodies and depends on the shape of the GraphQL response.
- 🟡 A finding a teammate raised is not verified by `--verify`; that is deliberate.

## Pros and Cons of the Options

### 1 - Markers on GitHub

- Good: one source of truth that every machine sees; robust to cleaned runs and force-pushes.
- Bad: comment-body parsing; the marker format cannot change freely.

### 2 - Local run files

- Good: structured data BDK wrote itself.
- Bad: missing on another machine or after a clean; blind to what was actually posted after the user edited it.

### 3 - Every open thread

- Good: verifies all feedback.
- Bad: BDK would level and resolve threads other people opened.

## More Information

Sources: archived Changes of #205 (D7), #256 (D2) and #280 (D1-D3). The verify flow is drawn in [Concepts: `/bdk:pr-review`](../concepts/orchestrators.md#bdk-pr-review-and-the-bdk-pr-review-round-lead).
