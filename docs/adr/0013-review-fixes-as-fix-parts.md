---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by: none
measured-by:
  - plugins/bdk/evals/auto-review-fix-round
  - plugins/bdk/evals/auto-review-present-behaviour
  - plugins/bdk/evals/plan-fixes-judged-round
  - plugins/bdk/evals/plan-fixes-spec-delta
---

# ADR-0013: Review fixes are planned as fix parts and built by the execute lead; every fix pass gets a review round

## Context and Problem Statement

A review round ends with findings, each levelled by the judge ([ADR-0006](0006-finding-levels-follow-product-behaviour.md)) and decided by triage. Most review loops let the reviewer, or the conversation that reads the review, patch the code in place: fast, but the patch skips the test-first, conform and check discipline that built the rest of the Change, and nothing checks it afterwards. Who fixes a finding, in what form, and what checks the fix?

## Decision Drivers

- **Correctness of the product** (problem 2 of v3): a fix is code like any other and can break what the review passed.
- **One block, one job:** reviewers check, implementers write; a reviewer that also fixes checks its own work.
- **Speed** (problem 1 of v3): every fix pass and round is on the critical path.
- **Resume from files** ([ADR-0003](0003-v3-architecture-skills-first.md)): a stopped stage continues from what it wrote.

## Considered Options

1. **Fix parts:** the findings decided `fix` become plan parts, built by the execute lead, followed by another review round.
2. **Fix in place:** the reviewer, or the main thread, edits the code for each finding.
3. **Fix parts without a following round:** the fixes are built test-first but not reviewed again.

## Decision Outcome

**Chosen option: 1.** The review never fixes in place. `/bdk:plan-fixes` reads the findings of a round whose latest decision is `fix` and writes fix parts in the plan part format under the round directory (`<run dir>/review/round-<N>/fixes/parts/NN.md`, never `plan/parts/`), one task per finding, ids continuing after the plan's and every earlier round's parts, findings on the same file in the same part:

- a finding that breaks a spec scenario lists that scenario as an acceptance test;
- a finding that asks for a test of behaviour the code already has lists its scenario with the suffix ` (behaviour present)`, so the implementer does not expect it red;
- a finding whose fix is spec-delta text the proposal or design already settles is a task on that delta file, verified by `openspec validate --strict` and the next round's spec conformance;
- a finding whose fix needs a product decision (it contradicts another scenario, the proposal or the design, or none of them settles it), or whose cause cannot be found, goes under `## Not planned` and stops the stage `blocked`.

The fix pass is a `bdk:lead` running `/bdk:execute-waves --parts <round dir>/fixes/parts`: implement, conform, part and wave checks and commits, exactly as for the plan. A review round always follows a done fix pass, also when every fixed finding was `should-fix`; the loop ends when a round has no `fix` decision or `policy.budgets.review-rounds` is spent. The next round reviews only the fix commits ([ADR-0014](0014-later-rounds-review-the-fix-scope-and-re-run-every-check.md)).

It is the only option where every line of a fix is written test-first, conformed and reviewed like the code it fixes.

### Consequences

- ✅ A fix gets the same discipline and the same review as the plan; no unreviewed code reaches close.
- ✅ The stage resumes from files: `fixes/index.md`, `fixes/parts/`, `fixes/result.md` and the next round's directory say where it stopped.
- ✅ A finding that needs the user stops the stage instead of being guessed.
- ❌ A one-line `should-fix` costs a fix pass and a whole round; bounded by the round budget and the narrow scope of later rounds.
- 🟡 The fix parts live in the run directory, outside git; only their commits reach the Change branch.

## Pros and Cons of the Options

### 1 - Fix parts and a round per fix pass

- Good: same TDD, conform and check discipline; every fix reviewed; resumable.
- Bad: time and tokens per round.

### 2 - Fix in place

- Good: fastest for small findings.
- Bad: no red test, no conform, no review of the fix; the fixer checks its own work.

### 3 - Fix parts without a following round

- Good: the discipline of option 1 at the cost of one fewer round.
- Bad: a fix that breaks something else reaches close and the pull request unseen.

## More Information

Sources: archived Changes of #201 (D2, D6), #346 (D1-D2) and #373 (D1-D3). The flow is drawn in [Concepts: `/bdk:auto-review`](../concepts/orchestrators.md#bdk-auto-review).
