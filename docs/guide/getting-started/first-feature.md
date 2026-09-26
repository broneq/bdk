# Your first feature

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

One toy change, carried through the full tier end to end:
**add a `--dry-run` flag to the export command**. Five commands, five artifacts,
each one a file you can read before you continue.

Every stage is a seam. The artifact is the hand-off, so you can close the
session after any step and pick up in a fresh one.

!!! note
Work on a branch. `/bdk:subagent-execute-plan` refuses to run on `main` or
`master`, and refuses to start with a dirty working tree.

## 1. Design

```
/bdk:design add a --dry-run flag to the export command
```

`/bdk:design` dispatches `bdk:explorer` subagents to ground itself in your code
before it proposes anything, asks you to classify the work as product,
architecture, or combined, then offers at least two approaches with a Mermaid
diagram each and a devil's-advocate critique. A separate Opus `bdk:design-verifier`
subagent reviews the draft before it is written.

**Artifact:** `.bdk/design/YYYY-MM-DD-HHMM-<slug>-design.md`

**Before continuing:** read the "What we did NOT decide" section. Everything
left open there becomes a decision someone makes later, under more pressure. The
doc ends with its own hand-off line pointing at `/bdk:create-plan`.

## 2. Create the plan

```
/bdk:create-plan .bdk/design/2026-09-13-0930-dry-run-export-design.md
```

The skill finds the design doc by slug keywords and reads it, explores, picks an
approach with you, verifies its own outline, then writes the plan in one pass:

```
[create-plan] Found related design doc: {filename}
[create-plan] Setup complete. Plan: <path>
[create-plan] Launching {N} explorer(s): {list of agent names}
[create-plan] Exploration complete:
  - Utilities: {N}
  - Affected files: {N}
  - Similar features: {N}
  - Degraded agents: {list or "none"}
[create-plan] Design complete: {selected approach name}
[create-plan] Outline verified: {N} gaps found and fixed
[create-plan] Parallelism: {T} tasks in {W} waves (max width {widest wave size}, critical path {longest dependency chain})
[create-plan] Plan written: <path> — {N} tasks, {M} files to modify, {K} files to create
```

**Artifact:** `.bdk/plans/<timestamp>-<slug>.md`

**Before continuing:** read the plan's tasks. Each one declares `Files:` and
`Depends on:`, and those two lines are what let the executor run a wide wave
instead of a long serial chain. Edit now if anything is wrong: the plan's bytes
become its identity at the next step, so an edit after verification invalidates
the stamp.

## 3. Verify the plan

```
/bdk:verify-plan .bdk/plans/2026-09-13-0942-dry-run-export.md
```

One Opus `bdk:plan-verifier` subagent runs a six-section checklist against the
real code (signature drift, data trace, edge cases, regression flows, test
coverage, plan completeness) and returns a YAML verdict. A `FAIL` gets one
delta iteration; a second `FAIL` sends you back to `/bdk:design` rather than a
third pass.

On success the skill prints:

```
  Verdict:  PASS | PASS_WITH_WARNINGS
  Report:   .bdk/verify-plan/<plan-slug>-verification.md
  Plan sha: <first 12 chars>

  Next: /bdk:subagent-execute-plan <plan-path>
```

**Artifact:** `.bdk/verify-plan/<plan-slug>-verification.md`

**Before continuing:** read the `must_fix` entries, and on
`PASS_WITH_WARNINGS` read the warnings - they do not block execution but they
are worth knowing before subagents act on the plan. The `Plan sha:` is the
sha256 of the plan's bytes; the executor recomputes it and tells you whether it
is running the plan that was verified.

## 4. Execute

```
/bdk:subagent-execute-plan .bdk/plans/2026-09-13-0942-dry-run-export.md
```

The coordinator never edits a file itself. It groups file-disjoint tasks,
dispatches a fresh `bdk:implementer` per task, runs scoped tests and lint
through `bdk:test-runner` and `bdk:static-analyse`, routes failures to a fixer,
and commits one group at a time. It opens with:

```
[subagent-execute-plan] Plan loaded: {path}
  Resume: {yes, from group N|no}
  Verification: {stamped|stale|missing}
  Tasks: {N}
  Parallel groups: {G} {source}  (e.g. [1.1,1.2] [1.3] [2.1,2.2,2.3] [3.1])
  Base SHA: {short-sha}
  Manifest: .bdk/runs/{run-id}.json
  Worktree mode: same-worktree (disjoint files within group)
  Test/lint cadence: orchestrator judgment per group (max 2 consecutive skips)
  Test/lint scope: scoped to changed files; full suite once, at 4d
```

then one pair of lines per group:

```
[subagent-execute-plan] Group {n}/{G}: tasks {ids} — dispatching
[subagent-execute-plan] Group {n}/{G}: committed {short-sha}
```

and closes with a fixed-shape `[subagent-execute-plan-summary]` block
(`tasks_completed`, `groups_committed`, `final_tests`, `wall_clock_per_group`,
`status`, and more). The keys are documented in
[The full pipeline](../workflows/full-pipeline.md).

**Artifacts:** commits on your branch carrying `BDK-Run:` and `BDK-Group:`
trailers, plus a run manifest at `.bdk/runs/{run-id}.json`.

**Before continuing:** check the `Verification:` line said `stamped`, and that
`status:` is `success`. Git trailers are the durable record; the manifest is
only a cache, and the run state script corrects it from git whenever the two
disagree.

## 5. Review

```
/bdk:cr --full
```

`/bdk:cr` reviews only the delta since the last review by default. Before a PR,
always pass `--full`: a delta pass cannot see a later commit breaking an
earlier, already-reviewed one.

```
[cr] Step 1: Resolving range...
[cr] Range: {anchor}..{head} ({delta|full}, {anchor_source}) — {N} commits
[cr] Scope: {N} files changed, {N} lines → {tiny|small|large|massive}
[cr] Step 2: Dispatching {N} agents ({M} deferred findings suppressed)...
[cr] Step 3: Waiting for agents...
[cr] Step 4: Merging results...
[cr] ✓ Complete ({N} findings: {critical}C/{high}H/{medium}M/{low}L)
[cr] Report: {path}
```

**Artifact:** `.bdk/cr/{stamp}-{branch-slug}-{delta|full}.md`

**Before continuing:** the range line tells you whether this was a deliberate
full review or one that fell back to full because the watermark was lost -
`anchor_source` says which. Reviewers are read-only, so nothing was fixed:
acting on the findings is your next, explicit decision.

## Next time you may skip to a shorter tier

The full tier is for new features, architecture or schema changes, and anything
where the scope is still ambiguous. Most work is smaller:

- **[Standard](../workflows/standard.md)** - clear scope, several files, no open
  design questions. Start at `/bdk:create-plan`, optionally verify, execute, and
  review with `/bdk:cr`.
- **[Trivial](../workflows/trivial.md)** - one or two files and an obvious
  change. No BDK skill at all: Claude Code's built-in plan mode, the edit, then
  `/bdk:cr --inline`. It is safe without skills because the shared foundation is
  injected into every session.

The [tier table](../index.md#how-you-work-with-it) sums up when each fits.

## What you get

- A design doc, a plan, a verification report, a branch of grouped commits with
  run trailers, and a code review report.
- A run manifest that lets any of those steps resume in a fresh session.

## Next step

[The standard tier](../workflows/standard.md).
