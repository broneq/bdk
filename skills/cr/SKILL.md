---
name: cr
description: Run code review with dynamic agent scaling (3-13 agents based on change size). Delta since the last review by default; --full whole branch; --inline runs in-session with no subagents; --base <ref> explicit baseline (stacks).
model: sonnet
effort: high
argument-hint: "[--full] [--inline] [--base <ref>] [focus]"
allowed-tools: Bash(git *) Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*) Bash(cat ${CLAUDE_PLUGIN_ROOT}/skills/cr/references/*) Write(.bdk/cr/**)
disallowed-tools: Edit NotebookEdit
---

# Dynamic Code Review Orchestrator

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Determine what changed, dispatch specialized reviewers in parallel, merge their findings into one report.

**Delta by default.** On a branch with an execution run, this reviews only the commits added since the last review. Pass `--full` to review the whole branch - always do that for the review before opening a PR, since a delta pass cannot see a later commit breaking an earlier, already-reviewed one.

## Safety Rules (MANDATORY)

- **MUST NOT modify source files.** No `Edit`, no `NotebookEdit`, and no `Write` outside `.bdk/cr/`.
- The first two are enforced mechanically: `disallowed-tools: Edit NotebookEdit` in the frontmatter removes them from the pool while this skill is active, so "review only" is a property of the turn rather than a promise in prose.
- `Write` cannot be removed the same way - the report needs it. It stays bounded by the narrow `Write(.bdk/cr/**)` grant plus the rule above: a `Write` anywhere else is a rule violation, and the grant means it also costs a permission prompt, which is the signal that something has gone wrong. Stop and report instead of answering that prompt.
- All sub-agents are read-only. Findings go into the report; fixing them is a separate, explicit decision by the user.

## Terminal Output

**On start:**
```
┌─────────────────────────────────────────────────┐
│  👁️  ORCHESTRATOR: code-review                   │
│  📋 Task: {brief description}                   │
│  ⚡ Model: sonnet                                │
└─────────────────────────────────────────────────┘
```

**During execution:**
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

The range line is not decoration. A reader must be able to tell a deliberate full review from one that fell back to full because the watermark was lost - `anchor_source` says which.

## Process

Fill the `REVIEW_REQUEST` block, then follow the engine.

!`cat ${CLAUDE_PLUGIN_ROOT}/skills/cr/references/review-engine.md`

### Filling the request

```
mode:        interactive
dispatch:    inline if $ARGUMENTS contains --inline, else agents
run_id:      from `bdk_run_state.py list --branch $(git branch --show-current)`, or null
base_sha:    `git merge-base HEAD <ref>` when --base <ref> is given;
             otherwise the run's base_sha, or `git merge-base HEAD origin/HEAD` with no run
head_sha:    git rev-parse HEAD
range_mode:  full if $ARGUMENTS contains --full, else delta
group:       null
scaling:     from the resolved range (engine Step 2)
focus:       the rest of $ARGUMENTS, or null
```

`--base` exists for stacked branches, where the honest baseline is the parent branch of the stack, not the repo default - deriving it from `origin/HEAD` would blame this branch for every change below it in the stack. `--base` implies no run watermark applies: treat it as `run_id: null` even when a run exists, because the run's baseline and the explicit one disagree by construction.

With `dispatch: inline` the Step 2 terminal line reads `Dispatching inline (no agents)` instead of an agent count, and Step 3 is the engine's "Inline dispatch" variant - every cohort performed sequentially in this session, spawning nothing.

Tool tier for reading the change set:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/review.chain.json`

Use it to add what the raw diff cannot give you, and pass the results into the dispatch as context: which changed files are architectural choke points (flag for `bdk:architecture-reviewer`), which execution paths are impacted (scope context for the test reviewer), and a risk score per file.

Then classify changed files by module, and pair each source file with its test file per the project's own conventions.

### Rendering the report

The engine returns a flat findings array. Render it as the 13 sections below and write to:

```
.bdk/cr/{stamp}-{branch-slug}-{delta|full}.md
```

where `stamp=$(git log -1 --format=%cd --date=format:%Y-%m-%d-%H%M)` - the reviewed head's own commit date, not wall-clock time, so the filename identifies what was reviewed and re-running on an unchanged head overwrites rather than accumulates. Using `git log` also keeps this inside the existing `Bash(git *)` grant.

Derive all 13 sections in one pass over the array - each section draws from its own category slice, so they are independent and there is no sequential construction to do.

With a run, add a **Deferred - not auto-fixed** block listing what `findings-list` holds: those are findings someone already saw and declined, and a report that silently omits them looks cleaner than the branch is.

## Report Format

Thirteen sections. The structure, checklists, and per-section source agents are defined once, here:

!`cat ${CLAUDE_PLUGIN_ROOT}/skills/cr/references/report-format.md`

## Rules

- Always print the terminal block on start and on completion.
- The range line always states `delta` or `full` and the `anchor_source`.
- Counts come from the merged findings array, never from recollection of what the agents reported.
- An agent that failed or timed out is named in the report. A partial review must never present as a complete one.
