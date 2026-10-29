---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by: none
measured-by:
  - plugins/bdk/evals/implement-part-plan-defect
  - plugins/bdk/evals/execute-plan-defect
---

# ADR-0021: A part edits only its declared files - a contract it cannot meet is a plan defect, never a workaround

## Context and Problem Statement

`/bdk:implement-part` builds one plan part on `bdk:implementer`. A part declares its `files` and holds task contracts (`File`, `Interface`, `Verified by`) written by the planner and checked by `/bdk:verify-plan`. Sometimes a contract is wrong: a task contradicts its scenario, names an interface that does not exist, or needs a file the part does not list. A coding agent normally improvises around a small plan error, and the run goes on. What does the implementer do when the part it was given cannot be built as written?

## Decision Drivers

- **Correctness of the product** (problem 2 of v3): a defect hidden in the code is not seen by `/bdk:verify-plan` or by the review.
- **One block, one job** ([ADR-0003](./0003-v3-architecture-skills-first.md)): the plan's author owns the plan; the implementer builds it.
- **The rest of the run reads `files`:** the conformer limits its diff to them, the review round groups files by part (`bdk git groups --plan`), and the part check picks its tests from them.
- **Bounded retries:** the part-attempt budget (`policy.budgets.part-attempts`) should go to work a retry can change.

## Considered Options

1. **Check every contract before editing; a contract that cannot be met, or a file outside `files`, stops the part as a plan defect** with a clean tree.
2. **The spec wins:** the implementer follows the scenario and adjusts the task silently.
3. **Allow small edits outside `files`** and record them.

## Decision Outcome

**Chosen option: 1.** Before it edits anything, the implementer reads the part, its acceptance scenarios in the deltas, `design.md`, the rules for its files and the project instructions, and checks each task: the interface exists or is to be created as written, the change fits `files`, the task agrees with its `Verified by` scenarios. A contract that is wrong, missing or contradicts a scenario, or a change that needs a file outside `files`, is `Status: blocker` with `Kind: plan-defect`, evidence and a proposal, and the block stops without editing. A need found late (a file outside `files`, an interface the part does not own) stops it the same way, listing what it changed. A gap the contract leaves open and the specs and code settle (a private helper's name) is decided and recorded under `Decisions taken without the user`. The same holds when the part and the code disagree about present behaviour ([ADR-0022](./0022-test-first-proved-by-recorded-red-run.md)).

The execute lead marks a `plan-defect` part `blocked` at once, without a retry, since a retry cannot change the part; the fix goes to the part's author (`/bdk:plan`, or `/bdk:plan-fixes` through `/bdk:auto-review`).

It is the only option that keeps the plan the single owner of what a part changes, so every later reader of `files` is right.

### Consequences

- ✅ A plan defect surfaces with evidence where it was made, instead of as an odd diff in review.
- ✅ A stopped part leaves a clean tree, so the retry after the plan fix starts from the committed parts.
- ✅ Review groups, conform scope and part checks can trust `files`.
- ❌ A run stops on a defect a person might have fixed in a line; it costs a re-plan round.
- 🟡 Execute first ran parts of a wave in parallel worktrees merged by `files` (#192); parts now build one at a time in the checkout, and the rule stands for the readers above.

## Pros and Cons of the Options

### 1 - Stop on a plan defect

- Good: the defect is visible and fixed at its source; the part's file set stays true.
- Bad: one more planning round for a small error.

### 2 - The spec wins

- Good: the run finishes on its own.
- Bad: the implementer picks a side the planner and verifier missed, silently; the plan no longer describes the code.

### 3 - Small edits outside `files`

- Good: fewer stops.
- Bad: the conformer and the review groups no longer see every change of the part; unplanned overlaps between parts.

## More Information

Archived Changes `v3-192-execute-blocks` (design D3) and `v3-346-fix-part-test-only-red` (design D4).
