---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/src/git/tests/use-cases.test.ts
  - plugins/bdk/evals/auto-review-fix-round
  - plugins/bdk/evals/auto-review-test-only-fix
  - tests/eval-suites.test.ts
---

# ADR-0014: A later review round reviews only the fix commits but re-runs every check, spec conformance and E2E

## Context and Problem Statement

Every fix pass is followed by a review round ([ADR-0013](0013-review-fixes-as-fix-parts.md)). In B1 of draft 1, rounds 3 and 4 paid a full opus integration review each for a handful of fixed lines. A narrow round is cheap, but a fix can break behaviour outside the lines it changed, and only the product-level checks see that. What does a round after the first cover?

## Decision Drivers

- **Speed** (problem 1 of v3): a full re-review per round repeats the cost of round 1 for a few changed lines.
- **Correctness of the product** (problem 2 of v3): a fix may regress behaviour elsewhere; that regression is exactly what a narrow check misses.
- **Predictable rules:** the scope of a round must follow from files, not from a judgement of which processes a fix reaches.

## Considered Options

1. **Narrow review, full checks:** a later round reviews only the fix commits, and every check, spec conformance and the full E2E check run again.
2. **Full re-review every round.**
3. **Narrow everything:** review, checks and E2E limited to what the fix touched.

## Decision Outcome

**Chosen option: 1.** A round `N` above 1 anchors on the previous round's head (`bdk git groups --rounds`, `groups.json` anchor `kind: round`), groups only the files the fix commits changed, by fix part, and its integration reviewer follows only the contracts those files reach; a defect it sees outside is still logged. The checks of the `review` point run in every round against the base branch, spec conformance runs in every round ([ADR-0015](0015-spec-conformance-every-round-and-at-close.md)), and the full E2E check runs in every round. E2E is never narrowed to the processes a fix touched.

The one exception: a round whose whole scope is test files (`testsOnly: true` in `groups.json`, or an empty scope), after a last E2E verdict of `PASS` or `SKIPPED`, carries that verdict over. It starts no `bdk:e2e-tester`, writes no `e2e/` directory, and its `round.md` names the verdict file it carries; the product is the one that verdict checked. A `FAIL`, `BLOCKED` or missing verdict is never carried over, and neither is a scope with any other path.

It is the only option that keeps a later round cheap on review and still checks the whole product after every fix.

### Consequences

- ✅ A later round costs reviewers in proportion to the fix, not to the Change.
- ✅ A fix that breaks behaviour elsewhere fails a check, spec conformance or E2E in the same round.
- ❌ Every round pays a full E2E run (about 90 s in the fixtures) and the whole `review` check point.
- 🟡 Readers of the latest E2E verdict (close, spec conformance) must follow a carried verdict back to the round that wrote it.

## Pros and Cons of the Options

### 1 - Narrow review, full checks

- Good: cheap review; product-level regressions still caught.
- Bad: one round mixes a narrow review scope with whole-product checks.

### 2 - Full re-review every round

- Good: nothing is missed by scope.
- Bad: B1's rounds 3 and 4; the cost of round 1 per fix pass.

### 3 - Narrow everything

- Good: the cheapest round.
- Bad: a wrong file-to-process mapping misses exactly the regression outside the fix.

## More Information

Sources: archived Changes of #201 (D4), #264 (D1-D4), #265 (D1) and #367 (D1-D2). The anchor kinds and `testsOnly` are computed by `bdk git groups` ([Reference](../reference/bdk/cli.md)); the round is drawn in [Concepts: `/bdk:review-round`](../concepts/orchestrators.md#bdk-review-round-lead-skill).
