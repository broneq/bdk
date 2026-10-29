---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/evals/spec-conformance-round
  - plugins/bdk/evals/auto-review-first-round
  - plugins/bdk/evals/close-conformance-fail
  - plugins/bdk/evals/close-e2e-cleared
  - tests/eval-suites.test.ts
---

# ADR-0015: Spec conformance runs in every review round and again at close; close stops on a failure and fixes nothing

## Context and Problem Statement

Living documentation (problem 3 of v3) holds only if the specs a Change merges describe the product it ships. `/bdk:spec-conformance` checks that: a `bdk:verifier` (opus) runs `openspec validate --strict` on the Change and compares its spec deltas with the diff and the E2E verdict. At first only `/bdk:close` ran it, before the archive. In the first run of #265 it failed there, on a spec delta that missed an error message, with no review round left to fix it: the run stopped at close. Where does the check run, and what may close do when it fails?

## Decision Drivers

- **Living documentation:** the archived specs must describe the shipped product.
- **A fix loop for every gap:** a mismatch found where nothing can fix it only stops the run.
- **No self-confirmation:** the conversation that built the Change must not patch the spec or the code until its own check passes.
- **Speed:** an opus verifier is the slowest worker of a round (about two minutes).

## Considered Options

1. **Every round and at close:** the check is a worker of every review round, and close runs the same check again as a gate that fixes nothing.
2. **Close only**, as at first.
3. **Every round only**, with close trusting the last round's report.
4. **Close fixes what it finds:** close patches the delta or the code and archives.

## Decision Outcome

**Chosen option: 1.** `/bdk:spec-conformance --round <round dir>` runs on `bdk:verifier` in every review round, also a round with no review group, beside the integration reviewer and the E2E tester. It logs each mismatch as a finding where the fix goes, the code or the spec delta, `openspec validate --strict` errors included; the judge levels it like any other finding (a spec check finding that holds is a `blocker`, [ADR-0006](0006-finding-levels-follow-product-behaviour.md)), and the fix pass fixes it ([ADR-0013](0013-review-fixes-as-fix-parts.md)), spec-delta text included. So a spec gap gets a round to fix it and a round to check the fix.

`/bdk:close` runs the same check, against the same diff base, before the archive. It re-checks a Change that is not yet archived even when an earlier report passed, since the code may have changed; the verifier carries the earlier report's ids over. On anything but `Verdict: PASS`, or no report, close stops before `openspec archive`: no archive, commit, push or pull request. It names the verdict, the report and the side to fix, and never edits code, a spec delta or a main spec. Because every round ran the check, close fails only on what changed after the last round.

A failed E2E path of the last round's verdict does not fail the check when every `e2e-check` finding on that path was levelled `not-a-problem` by the round's judge: the check lists it as cleared under `Checked`, and the pull request body names it next to the `FAIL` verdict.

It is the only option that gives every spec gap a fix loop and still lets close refuse to ship a product its specs do not describe.

### Consequences

- ✅ A spec gap is fixed inside the review loop, not discovered at the end.
- ✅ Close is a predictable gate: it passes a Change the last round passed unless something changed since.
- ✅ The conversation that built the Change cannot make the gate pass by editing what it checks.
- ❌ An opus verifier per round, and the same check once more at close.
- ❌ A one-line spec gap found at close costs another review loop, not a one-line edit.

## Pros and Cons of the Options

### 1 - Every round and at close

- Good: a fix loop for every gap and an independent gate.
- Bad: the check runs once per round plus once.

### 2 - Close only

- Good: one check per Change.
- Bad: a gap found at close has no round to fix it (#265, run 1).

### 3 - Every round only

- Good: no second check.
- Bad: a commit after the last round reaches the archive unchecked.

### 4 - Close fixes what it finds

- Good: no extra loop for a small gap.
- Bad: an unreviewed edit by the conversation that is gating its own work.

## More Information

Sources: archived Changes of #202 (D2, D3), #265 (D1-D4), #374 (D1-D4) and #396 (D1-D3). What the check compares is described in [Concepts: OpenSpec Changes](../concepts/openspec-changes.md); its place in the round in [Concepts: `/bdk:review-round`](../concepts/orchestrators.md#bdk-review-round-lead-skill).
