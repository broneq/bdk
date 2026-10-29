---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by: none
measured-by:
  - plugins/bdk/evals/e2e-check-proposal-paths
  - plugins/bdk/evals/judge-e2e-failure
---

# ADR-0020: E2E drives the user processes of the proposal, not the spec scenarios - the proposal line is the promise

## Context and Problem Statement

`/bdk:e2e-check` uses the product of a Change as its user would, in every review round and before close. Its first version replayed the scenarios of the spec deltas. Those scenarios are what the implementer turns into acceptance tests, so a replay re-ran what the test suite already proves, and it could not see what the proposal promises but no scenario states: in the measured case the proposal promised `tally total --json`, no delta named it, and the product ignored the flag. What does the E2E tester drive, what is a failure measured against, and where does a failure point?

## Decision Drivers

- **Correctness of the product** (problem 2 of v3): check the product against what it is meant to do, not against the tests written from it.
- **Speed** (problem 1 of v3): do not pay twice for what the test suite proves.
- **A manual tester's eye:** the paths that try to break a feature are where a person finds what tests miss.
- **One place for the promise**, so the judge, triage and close agree on what a failed path means.

## Considered Options

1. **The proposal names the user processes**; design and deltas only make expected values exact; a failure points at the proposal line.
2. **Replay the spec scenarios**, as the first version did.
3. **Replay the scenarios and add proposal paths on top.**
4. **Derive the processes from the requirements of the spec deltas.**

## Decision Outcome

**Chosen option: 1.** The tester reads `proposal.md` (Why and What Changes) and lists the user processes it adds or changes: something a user sets out to do and sees the result of. A proposal line that changes nothing a user does (a refactor, a module, a dependency) goes under `## Not a user process` of `verdict.md` with its reason and is not driven. Per process it drives at most 5 paths: one `main`, variants (another state or input the sources name or a user plainly meets) and at least one `break` (wrong input or order, a repeated or interrupted action, a missing precondition); the Change as a whole has no cap. `design.md` and the deltas only make an expected outcome exact (`Expected from:`). A `break` path whose outcome nothing states is held to the baseline every user expects (`Expected from: baseline`): a visible refusal that names the problem, no crash or stack trace, no lost or corrupted data, and a product that still works for the next action.

A failed path is a finding at the proposal line it comes from (`--file openspec/changes/<change>/proposal.md --line <N>`), with the path file as evidence. The proposal line is the intent: when a delta or `design.md` words the promise more narrowly than the proposal, or leaves the path's input out, the narrower text is a gap in the delta, not leave to break the promise, and the judge keeps the finding a `blocker` (#391; levels in [ADR-0006](./0006-finding-levels-follow-product-behaviour.md)). Whether the fix goes into the code or the user narrows the proposal is triage's call. How the tester drives a browser is [ADR-0004](./0004-e2e-browser-driver-playwright.md); how close clears a failed path is ADR-0015.

It is the only option that catches promises no scenario states without re-running the test suite as a slower second copy.

### Consequences

- ✅ E2E finds what a user meets and a spec scenario misses; the measured `--json` defect is found only this way.
- ✅ The run grows with what the Change changes (processes), not with the number of scenarios.
- ✅ The path files (`E2E/<process>--<path>.md`), the verdict lines, the judge rule and close all read one location for a failure: the proposal line.
- ❌ No one-to-one trace from a spec scenario to E2E evidence; a scenario is proved by its acceptance test, not by E2E.
- ❌ Listing the processes and their paths is the tester's judgement, so two runs may drive different variants.
- 🟡 A proposal written loosely makes loose promises: the tester holds the product to them, and the fix may be a narrower proposal.

## Pros and Cons of the Options

### 1 - Processes from the proposal

- Good: checks the intent; break paths and the baseline find defects no test asserts; findings name what was promised.
- Bad: judgement in deriving processes and expected values; paid paths per process.

### 2 - Replay the spec scenarios

- Good: a clear trace from each scenario to evidence.
- Bad: repeats the acceptance tests through a slower interface; blind to promises no scenario states.

### 3 - Scenarios plus proposal paths

- Good: keeps the trace and adds the intent.
- Bad: the slowest option, and the replayed half finds nothing the tests do not.

### 4 - Processes from the delta requirements

- Good: structured input.
- Bad: the deltas are written for tests and miss exactly what the proposal promises but no scenario states.

## More Information

Archived Changes `v3-321-live-e2e-from-proposal` (design D1-D5) and `v3-391-judge-defers-e2e-failure`.
