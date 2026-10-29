---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/evals/debug-fix
  - plugins/bdk/evals/diagnose-bug-not-reproduced
  - plugins/bdk/evals/diagnose-bug-related-defect
  - plugins/bdk/evals/debug-too-large
  - tests/eval-suites.test.ts
---

# ADR-0016: A bug fix is a reproduced, one-part Change; no reproduction, no Change

## Context and Problem Statement

v2's `/bdk:debug` investigated a bug, wrote a failing test and fixed the code directly: a code-only fix, with no spec of the expected behaviour and no product-level review. A full propose, design and plan per bug would give both, but at the cost of a feature for a one-line fix. Many bug reports also describe behaviour that is in fact correct, or mix the bug with neighbouring defects. How does a reported bug become a fix?

## Decision Drivers

- **Correctness of the product** (problem 2 of v3): a fix is proven by a test seen red on the reported input, and reviewed as a product change.
- **Living documentation** (problem 3 of v3): the expected behaviour the bug violated belongs in the specs.
- **Speed** (problem 1 of v3): a small fix must not pay for a whole design and plan loop.
- **Scope:** one bug per fix, so its review and its pull request stay about that bug.

## Considered Options

1. **A reproduced, one-part fix Change**, built, reviewed and closed by the normal stages.
2. **A code-only fix**, as in v2: a failing test and the fix, no Change.
3. **The full pipeline per bug:** propose, design and plan with their verifiers.

## Decision Outcome

**Chosen option: 1.** `/bdk:debug` routes every reported symptom, also one whose fix may be a single line, through `/bdk:diagnose-bug`:

- **Reproduce first,** on the product as a user would: a `tools.e2e` item, else the public interface the report names. A bug that does not reproduce gets `Status: not-reproduced` and no Change.
- **One fix Change:** after the root cause is found, `diagnose-bug` writes a Change whose spec delta holds the reproduction as a scenario with its exact input, a `design.md` with the root cause and the call sites the fix reaches, and one plan part whose only acceptance scenario is the reproduction. No `plan-draft` or `verify-plan` runs; the part passes `bdk plan check`.
- **Too large or a user's choice** (more than one part's limits, or two readings of the expected behaviour): the Change is written without a part (`Status: too-large`) and handed to `/bdk:design`.
- **One bug per Change:** a related defect found on the way is named on a `Related:` line and under Risks, never fixed in the same Change.

After the gate (`policy.gates.design`), the fix is built by `/bdk:execute` (the reproduction test seen red, then green), reviewed by `/bdk:auto-review` and closed by `/bdk:close`, the same stages as any Change.

It is the only option that proves the fix against the reported input, records the expected behaviour in the specs and reviews the fix at product level, without a design loop per bug.

### Consequences

- ✅ Every fix has a test seen red on the reproduction and a scenario in the living specs.
- ✅ `/bdk:debug` reuses execute, review and close unchanged, because the fix is a Change.
- ✅ A report that does not reproduce changes nothing.
- ❌ A one-line bug gets a spec delta, a plan part, a review round and a pull request.
- 🟡 A related defect needs its own `/bdk:debug` or `/bdk:propose`.

## Pros and Cons of the Options

### 1 - Reproduced one-part Change

- Good: proven, specified and reviewed; no design loop.
- Bad: Change overhead per bug.

### 2 - Code-only fix

- Good: fastest.
- Bad: no spec of the expected behaviour, no product-level review; the v2 path problem 2 of v3 names.

### 3 - Full pipeline per bug

- Good: everything a feature gets.
- Bad: rejected on speed; a design and plan loop for a known root cause.

## More Information

Sources: archived Changes of #204 (D1, D3, D5, D6), #262 (D7, D9) and #359 (D1-D2). The flow is drawn in [Concepts: `/bdk:debug`](../concepts/orchestrators.md#bdk-debug).
