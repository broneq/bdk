---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/src/plan/tests/check.test.ts
measured-by:
  - plugins/bdk/evals/implement-part-present-behaviour
  - plugins/bdk/evals/plan-draft-present-scenarios
  - plugins/bdk/evals/verify-plan-present-scenarios
---

# ADR-0022: Test-first is proved by a recorded red run - the plan, not the implementer, decides which scenarios are already green

## Context and Problem Statement

`/bdk:implement-part` writes a test for every acceptance scenario of its part and must see it fail before it writes any code: that is the block's main promise. A promise in the skill text alone is not checkable; an agent can report "red seen" without having run anything. And some scenarios are already satisfied by the code before the Change (a `MODIFIED` requirement that keeps a scenario, a review finding that only asks for a missing test): their test passes at once. Before #346 the implementer judged such a test itself and wrote an "already green" note, which cannot tell present behaviour from a test that asserts nothing (#262). How is test-first proved, and who decides that a test may pass at its first run?

## Decision Drivers

- **Correctness of the product** (problem 2 of v3): acceptance tests from the spec, seen failing for the right reason.
- **Checkable evidence** instead of self-report, for review, diagnostics and evals.
- **One block, one job** ([ADR-0003](./0003-v3-architecture-skills-first.md)): the author never checks its own work, so the block that writes a test does not rule on why it passes.
- **Resume from files:** a stopped part must restart from what is recorded.

## Considered Options

1. **A recorded red run through `bdk check`, and the planner marks present scenarios**; the verifier checks the marks, the implementer only enforces them.
2. **The implementer decides** when its red run passes, and notes it.
3. **Drop the findings or scenarios whose behaviour is present** from the plan.

## Decision Outcome

**Chosen option: 1.** The acceptance tests run before any code as a check with the id `<part-id>-red` (`bdk check plan <run-dir> <part-id>-red --at part --kind test --tests <file> ...`, then its lines and `bdk check record`), never as a test command the skill composes; the recorded check under `checks/` is the file behind the report's `red seen`, and the implementer reads each test's own failure in its output. The report line of an acceptance scenario ends `; red seen; green seen`.

A scenario the code already satisfies is decided by reading the code, not by running tests: `/bdk:plan-draft` and `/bdk:plan-fixes` trace its WHEN to the output and list it under `## Acceptance scenarios` with the suffix ` (behaviour present)`, and its `Verified by:` line ends `; it passes at its first run, the behaviour is present`. `/bdk:verify-plan` traces each scenario too and puts a missing or wrong marker under `Must address`; `bdk plan check` reports a marked scenario without that line as a `present-scenario` problem. The implementer runs the red check for a marked scenario as well and expects it to pass (`; green at first run (behaviour present); green seen`). When the part and the code disagree (an unmarked test passes, a marked one fails because the behaviour is missing), the part stops as a plan defect ([ADR-0021](./0021-part-edits-only-its-files-contract-defect-stops.md)).

It is the only option where every "this test may pass" claim is made by one block and checked by another, with a file behind every red run.

### Consequences

- ✅ "Acceptance tests first" is checkable from the run files; evals and `/bdk:diagnose-run` read it.
- ✅ A vacuous test cannot pass as present behaviour: the claim comes from a code trace that a verifier repeats.
- ✅ The part format, the report line and the verifier checklist share one marker, so resume and `plan-fixes` read it the same way.
- ❌ The planner and the verifier trace each scenario through the code, a paid step per part.
- ❌ The marker is part of the plan format committed in users' Changes; changing it touches every reader.
- 🟡 A scenario satisfied only in part, or only by an earlier part, is never marked: its test must fail first.

## Pros and Cons of the Options

### 1 - Recorded red run, planner marks

- Good: evidence on disk; the decision and its check sit in two blocks.
- Bad: more tracing at plan time.

### 2 - The implementer decides

- Good: no planner work.
- Bad: self-judged after the fact; a test that asserts the wrong thing passes too (#262).

### 3 - Drop present scenarios

- Good: nothing to mark.
- Bad: a scenario the Change owes stays without a test; the gap the review asked to close is hidden.

## More Information

Archived Changes `v3-192-execute-blocks` (design D4), `v3-346-fix-part-test-only-red` (design D1-D3) and `v3-382-plan-draft-present-scenarios` (design D1-D4).
