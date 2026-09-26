# Code review

!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).

Every tier ends here. `/bdk:cr` determines what changed, dispatches specialized reviewers
in parallel, and merges their findings into one report. `/bdk:pr-review` takes the result
to GitHub.

## The four modes

| Mode            | Command                | Baseline reviewed                                                                      |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------- |
| Delta (default) | `/bdk:cr`              | Only the commits added since the last review on this branch                            |
| Full            | `/bdk:cr --full`       | The whole branch, from its base                                                        |
| Inline          | `/bdk:cr --inline`     | Same range rules, but every cohort runs sequentially in this session with no subagents |
| Explicit base   | `/bdk:cr --base <ref>` | `git merge-base HEAD <ref>` - for stacked branches                                     |

Modes combine: `--full --inline` is a whole-branch review inside one session.

### Delta is the default

On a branch with an execution run, `/bdk:cr` reviews only what is new since the last pass.
That is what keeps mid-branch reviews cheap.

### Always `--full` before a pull request

A delta pass cannot see a later commit breaking an earlier, already-reviewed one. Run
`/bdk:cr --full` as the last review before you open the PR.

There is a second reason. The cumulative cohort - `bdk:architecture-reviewer`,
`bdk:dead-code-detector`, `bdk:duplicate-detector` - runs **only on a full-range review**,
because a symbol is dead only relative to the whole branch, a layer violation is
cumulative, and a duplicate needs both copies in view. On a delta pass those are skipped
and the report says so (`architecture_review: skipped:delta-pass`).

### `--base <ref>` for stacks

`--base` exists for stacked branches, where the honest baseline is the parent branch of
the stack, not the repo default - deriving it from `origin/HEAD` would blame this branch
for every change below it in the stack. It also implies no run watermark applies.

## What it prints

On start:

```
┌─────────────────────────────────────────────────┐
│  👁️  ORCHESTRATOR: code-review                   │
│  📋 Task: {brief description}                   │
│  ⚡ Model: sonnet                                │
└─────────────────────────────────────────────────┘
```

During execution:

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

The range line is not decoration. A reader must be able to tell a deliberate full review
from one that fell back to full because the watermark was lost - `anchor_source` says
which.

## Agent scaling

The size class comes from the resolved range's changed lines, not the whole branch:

| Class   | Lines     | Reviewers                                                                                      |
| ------- | --------- | ---------------------------------------------------------------------------------------------- |
| tiny    | < 50      | one `bdk:code-reviewer` covering everything, checking duplicates and dead code inline          |
| small   | 50-1000   | one layer reviewer, plus architecture, test, duplicate, dead-code, static-analyse, test-runner |
| large   | 1000-3000 | N layer reviewers, N = ceil(lines / 1000), capped at 5                                         |
| massive | 3000+     | as large, N capped at 5                                                                        |

That is the 3 to 13 agents the skill advertises. With `--inline`, multiple layer reviewers
collapse into one thorough pass - inline execution has no parallelism to buy.

## The report

Written to:

```
.bdk/cr/{stamp}-{branch-slug}-{delta|full}.md
```

`stamp` is the reviewed head's own commit date
(`git log -1 --format=%cd --date=format:%Y-%m-%d-%H%M`), not wall-clock time - so the
filename identifies what was reviewed, and re-running on an unchanged head overwrites
rather than accumulates.

Thirteen sections, opening with a scope header that states the range, the file count, the
size class, the agent count with any degraded names, and how many previously deferred
findings were suppressed. A report that does not say it was a delta pass reads as a full
review of the branch, which is the one misreading that turns a clean report into a false
assurance.

### Deferred findings

With an execution run, the report closes with:

```markdown
## Deferred — not auto-fixed

| Severity | Category | Location | Problem |
|---|---|---|---|
```

Those are findings someone already saw and declined. They are withheld from this pass's
reviewers on purpose - otherwise every delta pass re-reports the same debatable MEDIUMs -
and listed at the end so the report stays honest about the branch's actual state rather
than about what was re-detected.

!!! note
`/bdk:cr` never fixes anything. All sub-agents are read-only; findings go into the
report, and fixing them is a separate, explicit decision by you.

## Reviewing GitHub pull requests

```
/bdk:pr-review <pr-url> [<pr-url> ...] [--verify] [focus]
```

One reviewer subagent per PR, each running `/bdk:cr --inline` in its own detached
worktree. The orchestrator aggregates every PR in the run and shows you a full report
before anything reaches GitHub:

```
── PR #{n}: {title} ── computed verdict: {✅ Approve | ❌ Request changes}
Blockers ({n}):
  - {path}:{line} [{SEVERITY}] {one-sentence problem}
Nice to have ({n}) - review these, real issues sometimes land here:
  - {path}:{line} [{category}] {one-sentence problem} → {one-sentence fix}
```

!!! warning
Nothing is posted to GitHub until you confirm. You confirm or override each PR's
verdict, and only then does a single review call per PR post the inline comments,
the summary, and the event.

Verdict policy: any confirmed CRITICAL or HIGH computes to request-changes; only MEDIUM or
LOW computes to approve. Nice-to-haves never block by themselves, but the complete list
reaches you precisely so one that actually matters can get an override. On your own PR the
GitHub event is forced to `COMMENT`, since GitHub rejects self-approval.

### Stacked PRs

When a PR's base is not the repo default branch and an open PR has that base as its head,
`/bdk:pr-review` detects the stack and scopes the review to **this PR's own diff versus
its parent branch** - the parent's changes get their own review in their own PR. There is
no auto-expansion: one URL reviews one PR, so list every stack entry you want reviewed.

### `--verify`

`--verify` switches every PR in the invocation to the follow-up pass: did the author
implement what the previous review asked for? It reads the previous review's comments
(the templates carry hidden markers for exactly this), classifies each, and after posting
resolves the threads that were addressed.

## What you get

| Artifact      | Path                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| Review report | `.bdk/cr/<stamp>-<branch-slug>-delta.md` or `-full.md`                                         |
| PR review     | inline comments plus one templated summary on GitHub, with an approve or request-changes event |

## Next step

Ship it, then keep the rules honest: [Rules hygiene](rules-hygiene.md).
