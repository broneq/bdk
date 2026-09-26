# Full pipeline

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

The full tier is five stages, each consuming the previous stage's output:

```
/bdk:design  ->  /bdk:create-plan  ->  /bdk:verify-plan  ->  /bdk:subagent-execute-plan  ->  /bdk:cr
```

Use it for a new feature, an architecture or schema change, or any scope you cannot state
in one testable sentence. See the [tier table](../index.md#how-you-work-with-it).

## Stage 1 - Design

```
/bdk:design <feature or capability>
```

`/bdk:design` is a design partner, not a generator. It grounds itself in your codebase
first (parallel `bdk:explorer` subagents, mandatory), classifies the work as product /
architecture / combined, then iterates with you: 2+ approaches at every branching
decision, a Mermaid diagram per approach, tradeoffs stated concretely, and a
devil's-advocate pass that must name a bottleneck, a single point of failure, a hidden
cost, and an unconfirmed assumption.

Before the doc is written, a separate Opus `bdk:design-verifier` subagent critiques the
draft cold - the author of a design has confirmation bias against it, so the critique
moves out of the author's head.

!!! warning
    If the chosen approach changes the database schema, the Schema-Change Gate is
    non-skippable. `/bdk:design` shows the current schema, presents 2+ proposals with
    migration and rollback implications, and requires explicit approval. A thumbs-up on
    the broader design is not schema approval.

Output: `.bdk/design/YYYY-MM-DD-HHMM-<slug>-design.md`, including a "What we did NOT
decide" section listing every open question.

## Stage 2 - Plan

```
/bdk:create-plan <feature description or design doc path>
```

`/bdk:create-plan` explores via subagents, compares 2-3 approaches, then writes a
TDD-driven plan. Two properties matter downstream:

- Every task declares `Files:` and `Depends on:`. The executor computes parallel waves
  from those edges, so a spurious dependency serializes work that could have run at once.
- Tasks are bite-sized: one test file, at most one production file, at most 40 LOC delta.
  Content-only tasks declare `Verification: none` instead of test cases.

It closes with:

```
[create-plan] Done.

  Plan:        <path>
  Approach:    {selected approach name}
  Complexity:  {LOW|MEDIUM|HIGH}
  Tasks:       {N}
  Files:       {M} to modify, {K} to create
  Parallelism: {W} waves, max width {widest}, critical path {longest chain}

  Next steps:
    1. Review the plan
    2. Edit if needed
    3. Verify with /bdk:verify-plan <path>
    4. Execute with /bdk:subagent-execute-plan <path>
```

**Edit before verifying.** The hash is over the plan's bytes.

## Stage 3 - Verify

```
/bdk:verify-plan .bdk/plans/<ts>-<slug>.md
```

One Opus `bdk:plan-verifier` subagent runs a six-section checklist against the real code:
signature drift, data trace, edge cases, regression flows, test coverage, plan
completeness. On `FAIL` it iterates once via `SendMessage`; a second `FAIL` stops and
recommends `/bdk:design`, because two failed passes mean the plan is structurally wrong.

On pass it stamps the plan's sha256 into the report and prints:

```
  Verdict:  PASS | PASS_WITH_WARNINGS
  Report:   .bdk/verify-plan/<plan-slug>-verification.md
  Plan sha: <first 12 chars>

  Next: /bdk:subagent-execute-plan <plan-path>
```

## Stage 4 - Execute

```
/bdk:subagent-execute-plan .bdk/plans/<ts>-<slug>.md
```

The executor is a **coordinator only**: it holds plan state, builds a schedule, and
dispatches subagents. It never edits files, never runs tests, never reads source. Each
task gets a fresh `bdk:implementer` with clean context; groups of file-disjoint tasks run
in parallel; each group ends in one commit carrying `BDK-Run:` and `BDK-Group:` trailers.

Preconditions it enforces at Step 0: you are not on `main`/`master`, and the working tree
is clean. A missing or stale verification stamp warns and continues - skipping
verification is your call, not the executor's.

At the end of the plan it runs the review engine once over the whole branch, plus an
architecture review and the full, unscoped test suite. It prints a stable
`[subagent-execute-plan-summary]` block with counts, timings, and
`final_gate: optimistic|rerun:{cycles}`.

If the coordinator's own context reaches 50% at a group boundary, it commits the
in-flight group and stops with a `[subagent-execute-plan-paused]` block naming the resume
command. Re-invoking the same skill resumes from the commit trailers.

## The seams are files

| Seam | Carrier |
|---|---|
| design -> plan | the design doc at `.bdk/design/` |
| plan -> verify | the plan file |
| verify -> execute | `.bdk/verify-plan/<slug>-verification.md`, carrying the plan's sha256 |
| execute -> review | git commit trailers (`BDK-Run:`, `BDK-Group:`) plus `.bdk/runs/<run-id>.json` |

No stage depends on conversation state, so any stage can run in a fresh session - or on
another machine, after a crash, days later.

## The plan file is immutable once verified

Its sha256 is the run's identity. Edit before verifying, never after: the executor
re-hashes the file and reports a post-verification edit as a stale stamp. To change
course mid-run, stop, edit, re-verify, and start a new run - the already-committed groups
stay committed and the new run picks up from the trailers.

Progress is recorded per group in two places. Commit trailers are the durable ground
truth (they survive a crash, a new session, a deleted `.bdk/`, and a rebase); the run
manifest at `.bdk/runs/<run-id>.json` is a cache that makes resume cheap. On any
disagreement git wins and the manifest is corrected. Everything under `.bdk/runs/` is
machine-owned and gitignored - never edit it by hand. See
[The plan pipeline](../concepts/plan-pipeline.md).

## Running plans in parallel worktrees

Two plans that touch the same files cannot run in the same checkout - the executor's
clean-tree precondition and its per-group commits would interleave. Give each run its own
worktree:

```bash
git worktree add ../myproject-featA -b feat/a
git worktree add ../myproject-featB -b feat/b
```

Then open a Claude Code session in each and run `/bdk:subagent-execute-plan` there. This
works with no extra machinery because the run id is `<plan-slug>--<branch-slug>`:
different branches mean different run ids, different manifests, and trailers that never
match each other's `git log`. Nothing coordinates the two runs, which is the point -
merge them the way you merge any two branches.

!!! warning
    One session per worktree. Two sessions in one worktree contend for the same run, and
    the second is refused by the session guard. Take over a run held by a dead session
    with `--force`, which prints exactly what it took over.

## Stage 5 - Review

```
/bdk:cr --full
```

Always `--full` before opening a pull request: a delta pass cannot see a later commit
breaking an earlier, already-reviewed one. See [Code review](code-review.md).

## What you get

| Artifact | Path |
|---|---|
| Design doc | `.bdk/design/<ts>-<slug>-design.md` |
| Plan | `.bdk/plans/<ts>-<slug>.md` |
| Verification report | `.bdk/verify-plan/<plan-slug>-verification.md` |
| Run manifest (machine-owned, gitignored) | `.bdk/runs/<run-id>.json` |
| One commit per group, with `BDK-Run:` / `BDK-Group:` trailers | your branch |
| Review report | `.bdk/cr/<stamp>-<branch-slug>-full.md` |

## Next step

[Code review](code-review.md) for the four `/bdk:cr` modes and the pull-request pass.
