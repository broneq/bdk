# Standard workflow

The standard tier drops the design stage and keeps everything else:

```
/bdk:create-plan  ->  (/bdk:verify-plan)  ->  /bdk:subagent-execute-plan  ->  /bdk:cr
```

Use it when scope is clear and design questions are already settled, but the work still
spans several files and deserves a plan, parallel execution, and a review pass. See
[Choosing a tier](choosing-a-tier.md).

## 1 - Plan

```
/bdk:create-plan add rate limiting to the public API endpoints
```

`/bdk:create-plan` refuses two kinds of input, and both refusals save you time: an empty
argument, and a vague one (fewer than ten words, or generic like "make it better"), which
it redirects to `/bdk:design`. If you get that redirect, you are in the full tier - go
run [the full pipeline](full-pipeline.md).

It explores via subagents (never from the orchestrator), compares 2-3 approaches, then
writes a TDD plan whose task graph is deliberately wide rather than deep. It closes with
the handoff block:

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

Read the plan. Fix what is wrong **now** - editing after verification invalidates the
stamp, because the hash is over the plan's bytes.

## 2 - Verify (optional, and usually worth it)

```
/bdk:verify-plan .bdk/plans/<ts>-<slug>.md
```

Verification is in parentheses in the tier table because the executor does not require
it: a missing or stale stamp warns and continues. It is still the cheapest bug you will
ever fix. One Opus pass checks the plan against the real code - signature drift, data
traces, missing edge cases - before any subagent acts on it.

Skip it when the plan is small, mechanical, and you have read every task. Run it when the
plan touches code you have not read recently.

!!! note
    Verification also stamps the plan's sha256, which is what lets the executor tell you
    whether what it is about to run is what was verified.

## 3 - Execute

```
/bdk:subagent-execute-plan .bdk/plans/<ts>-<slug>.md
```

Before anything is dispatched it prints what it is about to do:

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

Two lines are worth reading every time. `Verification:` tells you whether the stamp
matched. `Parallel groups:` names where the grouping came from - `(plan waves,
validated)`, `(explorer-derived)`, or `(serial: {reason})` - so a genuinely serial plan
never looks like a failed grouping.

Then it works group by group, announcing each transition:

```
[subagent-execute-plan] Group {n}/{G}: tasks {ids} — dispatching
[subagent-execute-plan] Group {n}/{G}: committed {short-sha}
```

Everything before the end-of-plan gate is scoped to what changed: per task, the task's own
test file; per group, the group's changed files on the fast tier only; per fix cycle, the
failures. The full unscoped suite runs once, at the end. See
[Verification scoping](../concepts/verification-scoping.md).

## 4 - Review

```
/bdk:cr
```

With no flags this reviews the **delta** - only the commits added since the last review
on this branch. That is the right pass mid-branch, when you already reviewed what came
before.

Before opening a pull request, run `/bdk:cr --full` instead. See
[Code review](code-review.md).

## When a standard run goes sideways

| Symptom | Do this |
|---|---|
| `/bdk:create-plan` redirects you to `/bdk:design` | The scope is ambiguous. Take the redirect. |
| `/bdk:verify-plan` returns `FAIL` twice | It stops and recommends `/bdk:design`. The plan is structurally wrong. |
| Executor stops: working tree dirty | Commit or drop your own edits. It refuses to commingle them with plan execution. |
| Executor stops: run held by another session | That run is live elsewhere. Re-invoke with `--force` only after confirming the other session is gone. |
| Executor pauses at 50% context | Re-invoke the same command. It resumes from the commit trailers. |

More symptoms and their exact messages are in
[Troubleshooting](../troubleshooting.md).

## What you get

| Artifact | Path |
|---|---|
| Plan | `.bdk/plans/<ts>-<slug>.md` |
| Verification report (if you verified) | `.bdk/verify-plan/<plan-slug>-verification.md` |
| Run manifest (machine-owned, gitignored) | `.bdk/runs/<run-id>.json` |
| One commit per group, with `BDK-Run:` / `BDK-Group:` trailers | your branch |
| Review report | `.bdk/cr/<stamp>-<branch-slug>-delta.md` |

## Next step

[Code review](code-review.md) - the delta pass you just ran, and the `--full` pass you
owe the pull request.
