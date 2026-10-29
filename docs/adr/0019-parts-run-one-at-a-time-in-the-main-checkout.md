---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by:
  - plugins/bdk/evals/execute-main-checkout
  - plugins/bdk/evals/execute-resume-main-checkout
  - plugins/bdk/src/plan/tests/part.test.ts
  - tests/eval-suites.test.ts
---

# ADR-0019: Plan parts run one at a time in the main checkout - no worktrees, part branches or merges

## Context and Problem Statement

The execute lead builds a Change one plan part at a time per agent ([ADR-0003](0003-v3-architecture-skills-first.md)). The first execute lead ran the parts of a wave in parallel: each in a lead-made git worktree under the run directory, on a branch `bdk/<change>/part-<NN>`, passed to the blocks by `--workdir`, merged back with `--no-ff` in part order, with `resolve-conflict` on a conflict (#200, #306). The host's own worktree isolation was not used, because it refused writes to the run directory and based worktrees on the remote default branch. The incident of #406 showed the cost of any worktree: it lacks the project's environment (dependencies, generated files, local services), so its checks fail or lie; the heavy checks of parallel parts cannot share one machine anyway; and the merges, conflict resolution and post-merge wave repairs cost time and tokens that parallel parts were meant to save. Where and in what order do the parts run?

## Decision Drivers

- **Checks that tell the truth:** a part's checks must run in the project as the user runs it.
- **Correctness:** each part is conformed and committed green before the next builds on it.
- **Simplicity:** no merge, conflict or worktree state to handle and resume.
- **Speed and cost** (problem 1 of v3): wall-clock time of plans with many independent parts, against the time and tokens of merges, conflicts and wave repairs.

## Considered Options

1. **One at a time in the main checkout:** waves in order, parts of a wave in ascending id, each committed before the next starts.
2. **Parallel parts in lead-made worktrees**, merged back in part order (the first design).
3. **Parallel parts in the host's worktree isolation** (`isolation: worktree`, `EnterWorktree`).
4. **Parallel parts in one checkout.**

## Decision Outcome

**Chosen option: 1.** Every part runs in the main checkout, on the Change branch: waves in ascending order, the parts of a wave in ascending part id. For each part the implementer, then the conformer, then the lead's commit, then the next part. The lead creates no git worktree and no part branch, merges nothing and passes no `--workdir`. A blocked part stops the stage at once and leaves its uncommitted work in the main checkout, where the next run continues from it. Waves stay the longest-path layers of `depends-on`; they set the order and where the wave check runs (repaired by `/bdk:repair-wave`), not parallelism. `bdk plan check` rejects a part that still holds `isolation`. Parallel work stays where it is read-only: reviewers, verifiers and the pull requests of `/bdk:pr-review` (`execution.max-parallel`).

It is the only option whose part checks run in the real project and whose history needs no merge.

### Consequences

- ✅ A part's checks run with the project's own environment.
- ✅ The Change branch holds one commit per part, in plan order, and no merge commit.
- ✅ Resume needs only `state.json` and the main checkout; no worktree or part branch to recover.
- ❌ A plan with many independent parts takes longer in wall-clock time.
- ❌ A later part builds on an earlier part's mistakes; the conformer, the per-part commit and the wave check bound this.
- 🟡 A run directory from an earlier BDK with `worktrees/` or part branches is not read.

## Pros and Cons of the Options

### 1 - One at a time in the main checkout

- Good: truthful checks; linear history; simple resume.
- Bad: no parallel writes.

### 2 - Lead-made worktrees

- Good: parallel parts; parts visible as merges in history.
- Bad: worktrees lack the project's environment (#406); merges, conflicts and `resolve-conflict` cost time and tokens; heavy checks compete for one machine.

### 3 - Host worktree isolation

- Good: no own worktree handling.
- Bad: refused writes to the run directory, a base from the remote default, one worktree per agent; and the same environment problem as option 2.

### 4 - Parallel parts in one checkout

- Good: the project's environment.
- Bad: two agents editing one tree; each part's checks see the other's half-done files.

## More Information

Sources: archived Changes of #200 (D2, D7, D8), #306 (D1-D3) and #406 (D1-D7), which superseded the parallel worktree design. The stage is drawn in [Concepts: `/bdk:execute`](../concepts/orchestrators.md#bdk-execute-and-the-bdk-execute-waves-lead).
