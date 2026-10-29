---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/evals/judge-levels
  - tests/eval-suites.test.ts
---

# ADR-0006: Finding levels follow the product's behaviour - a broken rule alone is never a blocker

## Context and Problem Statement

A review round reports findings from group reviewers, the integration reviewer, the spec check, E2E and red checks; the judge gives each one a level, and the level decides what the review loop does: a finding to fix starts a fix pass and another round on the fix scope, until nothing is left to fix or `policy.budgets.review-rounds` is spent. Most reviewers block on a rule violation. In B1 of draft 1, review rounds 3 and 4 went to minor entries of that kind, and 14 of the 17 rules of the rule pack are `kind: house`, a choice among valid alternatives. What decides a finding's level, and which levels may hold a Change back?

## Decision Drivers

- **Correctness of the product** (problem 2 of v3): what blocks is what makes the product wrong, not what makes the code unlike a convention.
- **Speed** (problem 1 of v3): every round is a full review on the critical path; rounds spent on style cost more than they return.
- **Rules still land:** a project's rules and instructions must still be fixed, not only reported.
- **One meaning per level** for the judge, triage, the review loop and close, so they never disagree.

## Considered Options

1. **The product's behaviour decides the level**; a rule or instruction break is at most `should-fix`.
2. **The rule decides**: a broken rule of severity `error` is a `blocker`, as in most code reviews.
3. **No levels**: every finding is fixed or accepted one by one.

## Decision Outcome

**Chosen option: 1.** The judge levels each finding by what the product does:

| Level | Definition |
|---|---|
| `blocker` | The product breaks a spec scenario or the intent of the Change; the specs would not describe the product after the Change (a spec check finding that holds); an E2E path fails (an E2E finding that holds); a check is red; a security hole; data loss; a regression of existing behaviour |
| `should-fix` | The product works, but the change breaks a rule or a project instruction, or has a concrete maintenance cost the finding names; or a scenario the Change owes has no test |
| `nice-to-have` | An improvement whose absence costs nothing concrete |
| `not-a-problem` | A false positive, out of the Change's scope, already handled, or a failure that does not hold |

A rule or instruction violation alone is never a `blocker`, however the reviewer words it. `blocker` and `should-fix` are both fixed while the round budget allows; in the last round a `should-fix` is deferred into the pull request body, so only a `blocker` can keep a Change from closing.

The design and plan verifiers are the exception, by design (#272): `/bdk:verify-design` and `/bdk:verify-plan` put a design or a plan part that breaks a rule selected for its stage under `Must address`, naming the rule's id, so the report fails (a design may depart from a rule only with a recorded agreement of the user). Before code exists, following a rule costs a sentence of the artifact; after execute, the same break costs a fix pass and a review round. These verifiers do not use the levels at all.

It is the only option that keeps rounds on what a user would meet and still fixes rule breaks, within a budget.

### Consequences

- ✅ A round's outcome reads as the product's state: no open `blocker` means no known breakage.
- ✅ Rule breaks are fixed in the same fix pass while the budget allows, and listed in the pull request when it runs out.
- ✅ The spec check, E2E and close share the judge's meaning: a finding close would refuse is a `blocker`, so the review never leaves one for close to stop on.
- ❌ A rule a team considers essential cannot block by itself; it blocks only when its break is also a product failure (security, data loss, a red check).
- 🟡 A rule break fails a design or plan verification but never blocks a review round, so the same rule weighs more before code exists than after.

## Pros and Cons of the Options

### 1 - The product's behaviour decides

- Good: rounds converge on product defects; the level is checkable against the code.
- Bad: the judge must trace each finding through the code, a paid step per round.

### 2 - The rule decides

- Good: familiar; strict teams get strictness.
- Bad: repeats B1's rounds 3 and 4; house rules block as hard as bugs.

### 3 - No levels

- Good: nothing to classify.
- Bad: no automatic policy is possible, so `policy.gates.review: auto` cannot decide, and every round waits for a person.
