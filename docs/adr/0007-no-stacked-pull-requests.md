---
status: accepted
date: 2026-10-29
decision-makers: broneq
enforced-by: none
measured-by:
  - plugins/bdk/evals/run-waiting-blocker
  - plugins/bdk/evals/run-two-prs
---

# ADR-0007: No stacked pull requests - every Change branches from the base and waits for its blockers

## Context and Problem Statement

`/bdk:run` takes a queue of Changes, often from issues that block one another, through every stage to a pull request each. The first architecture gave each Change its own PR, stacked on the branch of the previous one. A stack keeps dependent work moving, but every merge or review fix lower in the stack means rebasing and force-pushing the branches above it, under open reviews, in an unattended run. How do the branches and pull requests of a queue relate?

## Decision Drivers

- **Unattended safety:** an autopilot run must not rewrite history a reviewer is looking at.
- **Resume from files:** a run started again after a break or a merge must find each Change's state without reconstructing a stack.
- **Throughput** of a queue with dependent Changes.
- **Simplicity** of `/bdk:run`, `/bdk:close` and `run.json`.

## Considered Options

1. **No stacking:** every Change branches from the fetched base and opens its PR into it; a Change whose queue blocker is not merged waits.
2. **Stacked PRs:** each Change branches from the previous one; BDK rebases and force-pushes the stack after each merge.
3. **One branch and PR for the whole queue.**

## Decision Outcome

**Chosen option: 1.** Every Change gets its own branch from the base branch the run started on (`origin/<base>` after a fetch) and its own pull request into that base. `/bdk:run` orders the queue by "blocked by"; a Change whose blocker in the queue has no merged pull request is not started, the run goes on with the next independent Change and lists the waiting ones in its final report. A run started again after the merge picks them up. Nothing in BDK rebases, resets or force-pushes a branch, nor stacks one Change's branch on another's.

It is the only option that never rewrites a branch under review and keeps each Change resumable on its own.

### Consequences

- ✅ Every pull request shows exactly one Change against the base; review and merge order are the team's.
- ✅ `run.json` holds the queue and its current Change only; a Change's state comes from its own files and branch.
- ❌ A chain of dependent Changes advances one merge at a time: the run stops short and waits for a person to merge.
- 🟡 A blocker outside the queue never makes a Change wait; the team orders such work itself.

## Pros and Cons of the Options

### 1 - No stacking

- Good: no history rewrite; independent Changes run in parallel to review.
- Bad: dependent Changes wait for merges.

### 2 - Stacked PRs

- Good: a whole dependent chain reaches review in one run.
- Bad: rebase and force-push upkeep after every merge and fix, on branches with open reviews; conflicts in an unattended run; resume must rebuild the stack.

### 3 - One branch for the queue

- Good: no waiting, no rebase.
- Bad: one oversized review; a single defect holds back every Change in it.
