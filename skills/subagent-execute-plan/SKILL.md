---
name: subagent-execute-plan
description: >-
  Coordinator that executes a plan in parallel groups via background subagents.
  Spawns implementers, then dedicated test-runner / static-analyse subagents,
  then routes failures back to the original implementer (SendMessage) or a fresh
  fixer. Fully autonomous — no human-in-loop.
model: opus
effort: high
user-invocable: true
disable-model-invocation: true
argument-hint: "[plan-path]"
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*) Bash(git *)
---

# Subagent-Execute-Plan (Coordinator)

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

This skill is a **coordinator only**. It holds plan state, builds an execution schedule, and dispatches subagents. It never edits files, never runs tests, never reads source code. Subagents do all work.

**Why coordinator-only:** isolated context per subagent → no pollution. The coordinator's context stays small (plan, TaskList, last subagent return) so it can run a long plan without hitting its own context limit. Subagents do the heavy lifting and discard their context when they return.

**Core loop:**

```
plan → explorer (group disjoint tasks) → for each group:
  parallel implementers (background, in worktrees if needed) →
  decide: tests/lints worth running now? →
  if yes → test-runner / static-analyse subagents →
  if findings → SendMessage original implementer OR spawn bdk:fixer →
  commit group → next group
```

---

## Subagent fleet

| Agent | Purpose | Model | Spawn timing |
|---|---|---|---|
| `bdk:explorer` | Analyze plan tasks for file-disjoint groups | haiku | once, upfront |
| `bdk:implementer` | Implement one task end-to-end (TDD only — no final lint/test) | sonnet | per task, parallel where safe, background |
| `bdk:test-runner` | Run tests | haiku | per group, orchestrator's judgment |
| `bdk:static-analyse` | Lint changed files | haiku | per group, orchestrator's judgment |
| `bdk:fixer` | Apply specific findings | sonnet | on failures, when SendMessage to original is wrong fit |
| `bdk:code-reviewer` | Review final branch diff | sonnet | once at end |
| `bdk:architecture-reviewer` | Review architectural surface | opus | end, conditional |

The coordinator may spawn **multiple implementers in parallel** for a single group when `bdk:explorer` reports the tasks touch disjoint file sets. Same group → same worktree (disjoint files = no conflict).

---

## Subagent return contract (REQUIRED)

Every implementer / fixer dispatch must return the YAML envelope defined in `references/return-contract.md` as its **final** message. Four statuses: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`. Anything else is treated as `BLOCKED` with reason "malformed return."

The dispatch prompt (Step 3b) does **not** need to repeat the schema — the `bdk-implementer-return-contract` meta-skill is preloaded on the implementer and fixer agents' `skills:` list, so the contract arrives at spawn. The dispatch prompt ends with: "Return the YAML envelope per the preloaded `bdk-implementer-return-contract` meta-skill. Final message MUST be that YAML — no prose before or after."

Reviewer / verification subagents have their own return formats — see `references/dispatch-templates.md`.

---

## Step 0 — Prepare

1. **Validate input.** `$ARGUMENTS` must point to a plan in `.bdk/plans/`. If empty: list available plans, stop.
2. **Read plan once.** For each task extract:
   - Task number and title
   - Full task text
   - `Test cases:` block (drives implementer's TDD)
   - File paths the task touches
3. **Branch check.** If on `main` / `master`, stop with error. Coordinator never auto-switches branches.
4. **Working tree check.** `git status --porcelain` — if dirty, stop with error and list dirty paths. Refuse to commingle uncommitted user work with plan execution.
5. **Record `BASE_SHA`.** `git rev-parse HEAD` → store as a coordinator-local variable. Used by Step 4a (`BASE_SHA..HEAD`) and Step 3g declared-vs-actual reconciliation.
6. **Resume detection.** If a TaskList already exists for this plan slug (entries titled `[Group N] Task X.Y …`), load it and skip to the first `pending` group. Else rebuild from plan in Step 2.
7. **Spawn `bdk:explorer`** to compute parallel groups (Step 1) — only if not resuming.
8. **Build TaskList** (Step 2) — only if not resuming.
9. **Print summary:**

   ```
   [subagent-execute-plan] Plan loaded: {path}
     Resume: {yes|no}
     Tasks: {N}
     Parallel groups: {G}  (e.g. [1.1,1.2] [1.3] [2.1,2.2,2.3] [3.1])
     Base SHA: {short-sha}
     Worktree mode: same-worktree (disjoint files within group)
     Test/lint cadence: orchestrator judgment per group (max 2 consecutive skips)
   ```

---

## Step 1 — Explorer-driven group planning

Spawn `bdk:explorer` (one foreground call). Pass:

- The list of tasks (number, title, file paths declared in plan).
- The repo root.
- The schema and grouping rules from `references/explorer-contract.md` (verbatim).

The explorer returns the JSON envelope defined in `references/explorer-contract.md`: `confidence` (float), `groups[]` (ordered, each with `tasks` + `rationale`), `warnings[]`.

**Fallback triggers** (any → full serial mode, every task its own group): malformed JSON, `confidence < 0.6`, or any group referencing an undefined task id. See `references/explorer-contract.md` for full grouping rules and confidence calibration hints.

---

## Step 2 — Build TaskList

One `TaskCreate` per task, all `pending`. Track group membership in the task content (e.g. `[Group 1] Task 1.1 — Add lineChild group spec test`). The coordinator may add **dynamic** tasks during execution: verify-batch, fix-lint, fix-test. Add them as new TaskList entries when spawned, mark `completed` when their subagent returns success.

---

## Step 3 — Per-group loop

For each group in order:

### 3a. Pick implementer model per task

| Task profile | Model |
|---|---|
| 1–2 files, mechanical, full spec | `haiku` |
| Cross-file, integration, refactor | `sonnet` (default) |
| Architectural decision, broad surface, ambiguous spec | `opus` |
| Re-dispatch after `BLOCKED` due to reasoning gap | escalate one tier |

See `references/model-selection.md`.

### 3b. Dispatch implementers (parallel if group has >1 task)

For a multi-task group, send **one message with multiple `Agent` calls** using `run_in_background: true`. Each call passes:

- Full task text inline (do not make subagent re-read the plan)
- Test cases block
- File paths the task touches
- One-paragraph architectural context
- Branch name and `BASE_SHA`
- **Explicit instruction**: "Do not run final lint or test verification. The coordinator schedules those separately. Return the YAML envelope per the preloaded `bdk-implementer-return-contract` meta-skill (already on your `skills:` list) — final message MUST be that YAML, no prose before or after."

For a single-task group: foreground or background — both fine. Background is cheaper if the orchestrator has nothing to do meanwhile.

You will be notified when each background agent completes. Do not poll.

### 3c. Wait for group completion, handle each implementer's status

Each implementer returns one of:

| Status | Coordinator action |
|---|---|
| `DONE` | Record `files_changed`. Task is ready for verification. |
| `DONE_WITH_CONCERNS` | Read concerns. Correctness/scope concern → queue a fixer. Observation only → log, proceed. |
| `NEEDS_CONTEXT` | `SendMessage(to: agent_id, …)` with the missing context (cache likely warm). |
| `BLOCKED` | Diagnose: bad context → SendMessage; reasoning gap → spawn fresh implementer one model tier up; task too large → split task in TaskList, re-dispatch first slice; plan wrong → log and stop with explicit error. |
| (malformed return) | Treat as `BLOCKED` with reason "malformed return." Re-dispatch fresh, same tier. |

Max 3 re-dispatch cycles per task before stopping the whole skill with an error report.

> Re-dispatch ≠ fresh spawn. For `NEEDS_CONTEXT` and small clarifications, prefer `SendMessage(to: "<agent_id>", ...)` — the implementer keeps its prior reasoning. Spawn fresh only when escalating model tier. See STARTUP "Continuing a Spawned Agent".

### 3d. Decide: run tests/lints now? (pure judgment)

After all implementers in the group return `DONE`, decide whether to verify. No fixed cadence. Heuristics, not rules:

- Schema / API / public-contract change → likely yes.
- Trivial rename, comment-only edit, single-line tweak → likely no, batch with next group.
- Group included a "verify" task whose `Test cases:` block IS the verification → yes, that's the whole point.
- About to commit a group of >5 changed files → yes.
- Small group, low-risk, more tasks queued behind → defer to next checkpoint.

**Hard cap:** at most **2 consecutive groups** may skip verification. The 3rd group in a row MUST verify regardless of heuristic.

### 3e. Spawn verification subagents (when 3d says yes)

In **parallel** (one message, multiple Agent calls):

- `bdk:static-analyse` — pass the union of `files_changed` reported by implementers in this group.
- `bdk:test-runner` — pass relevant test paths if obvious from the group; otherwise full suite.

Both background. Wait for both.

**Record verifier `agentId`s** in per-group coordinator state (alongside `files_changed`) for SendMessage reuse in 3f. The recorded ids are scoped to **this group only** — never reuse a verifier across groups, since each group has a different `files_changed` set and reusing would poison context.

### 3f. Handle verification results

For each failure (lint or test):

- If the failure clearly belongs to one task and that task's implementer agent is still alive (cache warm, <5 min) → `SendMessage` to that implementer with the findings. It already has the file context. Cheap fix.
- Otherwise → spawn a fresh `bdk:fixer` subagent with the findings inline.

After fixers/SendMessage rounds return → **re-engage the same verifiers** via `SendMessage(to: <verifier_agent_id>, …)` recorded in 3e, passing only the new diff / changed files. The cache should still be warm (typically <5 min). If `SendMessage` errors (agent gone) or the cache window has expired → spawn fresh and increment a `verifier_cache_misses` counter (surfaced in Step 4e). Up to 3 verify-fix cycles per group. After 3 unsuccessful cycles → stop with error.

> Verifiers are stateless w.r.t. project semantics — they execute a command and report. Reuse saves the model's cold-start prompt without semantic risk. See STARTUP "Continuing a Spawned Agent" for the cache-window rules.

### 3g. Commit group

When the group passes verification (or was skipped per 3d):

1. **Reconcile declared-vs-actual files.** Run `git diff --name-only ${BASE_SHA_OR_LAST_COMMIT}` and compare to the union of `files_changed` returned by implementers. Log any mismatch as a warning (scope creep or undeclared edits) but proceed.
2. Stage exactly the files in the actual diff for this group:
   ```
   git add <reconciled-file-list>
   git commit -m "<group summary>"
   ```

The coordinator runs `git` directly — that is the one tool category it owns (mechanical, no judgment about code).

`TaskUpdate` all group tasks to `completed`. Continue to next group.

---

## Step 4 — End-of-plan review

All groups committed → run **once**, organized in two phases. Phase A converges code-review findings; Phase B runs architecture review and final tests **in parallel**.

### Phase A — Code review + triage

#### 4a. `bdk:code-reviewer` on `${BASE_SHA}..HEAD`

#### 4b. Triage findings

- `CRITICAL` / `HIGH` → spawn `bdk:fixer` per finding batch (group by file or by severity). After fixer commits, re-spawn `bdk:code-reviewer`.
- `MEDIUM` / `LOW` → log to `.bdk/cr/{branch}-summary.md`. Do not auto-fix — risk of overcorrection on debatable findings.

Up to 2 review-fix cycles. Remaining `CRITICAL` after cycle 2 → stop with error.

### Phase B — Parallel final pass (architecture review || final tests)

Once Phase A converges, dispatch the final two checks in a **single coordinator message with two background `Agent` calls** (`run_in_background: true`). Wait for both to complete before moving to 4e. Their failure paths are independent — each runs its own fixer cycles.

#### 4c. `bdk:architecture-reviewer` (conditional)

Spawn only if **any** of:

- Plan touched ≥ 3 modules
- Plan introduced new layers, public APIs, or cross-module dependencies
- Any task had architectural surface (judgment call from plan text)

Findings handled like 4b: `CRITICAL` / `HIGH` → `bdk:fixer`, then re-spawn `bdk:architecture-reviewer`. Up to 2 review-fix cycles.

If none of the conditions hold, **skip** the spawn — log `architecture_review: skipped:<reason>` in the summary. Phase B then degenerates to just the final test-runner.

#### 4d. Final `bdk:test-runner` (full suite)

Must pass. On failure, spawn `bdk:fixer` with failures, re-run. Up to 3 cycles.

**Independence:** architecture-reviewer is read-only (source + graph); test-runner is read-only (executes test commands). They cannot race on shared state. Fixer dispatches from either path are serialized through the existing 3-cycle cap and do not interleave across the two failure pipelines.

### 4e. Print summary, stop

Output exactly this fenced block (downstream tooling parses it). Keys are stable; values are scalars or short comma-lists.

```
[subagent-execute-plan-summary]
plan: {path}
base_sha: {short-sha}
head_sha: {short-sha}
tasks_completed: {N}
groups_committed: {G}
implementer_dispatches: {N}
implementer_redispatches: {N}
fixer_dispatches: {N}
sendmessage_rounds: {N}
verification_cycles_run: {N}
verification_cycles_skipped: {N}
verifier_cache_misses: {N}
final_tests: {pass}/{total}
review_critical_remaining: {C}
review_high_remaining: {H}
review_medium_logged: {M}
review_low_logged: {L}
architecture_review: ran|skipped:{reason}
context_stop_pct: 50
status: success|partial|error
```

The coordinator does not push or open PRs. That belongs to a downstream skill (`/bdk:commit`, the user's PR workflow).

---

## Context-stop policy

The coordinator monitors its own context usage between groups (not mid-group — never abandon in-flight subagents).

- **Threshold:** **≥ 50%** of coordinator context used at the boundary between two groups → finish the in-flight group (commit per 3g), do **not** dispatch the next group.
- **Action:**
  1. Run `/bdk:save-progress {plan-slug}-context-stop` so the run is resumable.
  2. Print the paused summary block:

     ```
     [subagent-execute-plan-paused]
     plan: {path}
     reason: context_stop
     threshold_pct: 50
     context_used_pct: {observed}
     groups_committed: {G}
     groups_remaining: {R}
     resume: /bdk:subagent-execute-plan {plan-path}
     save_progress_slug: {plan-slug}-context-stop
     ```
  3. Stop.
- **Resume:** Re-invoke `/bdk:subagent-execute-plan {plan-path}`. Step 0.6 (resume detection) finds the existing TaskList and picks up at the first `pending` group.

**Why 50% (and why this differs from `execute-plan`'s 40%):** the coordinator's context is mostly TaskList + last subagent return envelope + a slice of the plan — light per tick. `execute-plan` runs the implementation inline and accumulates file reads, test output, and edit diffs in its own context, so its threshold is lower. Both are documented constants — not user-tunable in this version. Revisit if reports come in (the prior observation of "stops at 50%" tracked in `docs/BUGS.md` #7 was intentional but undocumented; this section closes that gap).

The threshold actually used this run is surfaced in the Step 4e summary as `context_stop_pct: 50`.

---

## User-interrupt contract

Skill is autonomous, but not uninterruptible. If the user sends a message mid-run:

1. Finish any **in-flight** subagents (do not cancel — they may already hold dirty state).
2. Do **not** dispatch the next group.
3. Run `/bdk:save-progress {plan-slug}-coordinator-interrupt` so the run is resumable.
4. Surface the user's message + current progress, then stop.

The next `/bdk:subagent-execute-plan {plan-path}` invocation resumes via Step 0.6.

---

## Rules

- Coordinator never edits files, runs tests, runs lint, or reads source. It runs `git` (status, rev-parse, diff, add, commit) and dispatches subagents.
- Implementer subagents **do not** run final lint or test verification. They do TDD red-green for their own task and stop. Verification is a separate subagent the coordinator schedules.
- Parallel implementers are allowed only when `bdk:explorer` confirms file-disjoint sets within the group AND `confidence ≥ 0.6`.
- For verification failures: try `SendMessage` to the original implementer first if cache likely warm and scope is narrow. Fall back to spawning `bdk:fixer`.
- Verifiers (`bdk:static-analyse`, `bdk:test-runner`) are reused via `SendMessage` across verify-fix cycles **within a group**; fresh spawn only on cache miss. Never reuse verifiers across groups — each group's `files_changed` set differs.
- Subagents may invoke skills (e.g. `/bdk:test-driven-development`, `/bdk:save-progress`, `/bdk:restore-progress`) but cannot spawn nested subagents. Skills that themselves spawn subagents (`/bdk:execute-plan`, `/bdk:cr`) are forbidden inside subagents — coordinator handles those flows directly.
- Reviewer findings → fixer subagent. Coordinator never patches code itself.
- Max 3 re-dispatch cycles per task. Max 3 verify-fix cycles per group. Max 2 review-fix cycles at end-of-plan. Max 2 consecutive groups skipping verification.

---

## Anti-patterns

- ❌ Coordinator running `Edit`, `Write`, or test commands. Coordinator dispatches; subagents act.
- ❌ Implementer running final `npm test` / `pytest` / lint as part of its task. That belongs to dedicated verification subagents.
- ❌ Spawning parallel implementers without an explorer pass — silent file conflicts.
- ❌ Spawning `bdk:code-reviewer` per task. End-of-branch only — it sees cross-task patterns the per-task view misses.
- ❌ Sequencing `bdk:architecture-reviewer` and the final `bdk:test-runner` in Step 4. They are independent read-only checks and **must** be dispatched in a single coordinator message with `run_in_background: true`.
- ❌ Hardcoding test cadence ("every 3 tasks"). Pure orchestrator judgment per group, bounded by the 2-consecutive-skip cap.
- ❌ Asking the user for confirmation mid-flow. Autonomous skill — surface decisions only on terminal failure or user interrupt.
- ❌ Letting an implementer read the plan file. Pass full task text in the dispatch prompt.
- ❌ Hardcoding `pytest`, `npm test`, etc. in any prompt to a subagent. Subagents detect from project context.
- ❌ Accepting prose returns from implementers. Malformed return → `BLOCKED` and re-dispatch.

---

## References

- `references/return-contract.md` — REQUIRED YAML envelope every implementer/fixer subagent must emit. Source of truth.
- `references/explorer-contract.md` — REQUIRED JSON envelope `bdk:explorer` returns for group planning. Source of truth.
- `references/model-selection.md` — when to pick haiku vs sonnet vs opus for the implementer.
- `references/dispatch-templates.md` — exact dispatch prompts for explorer, implementer, fixer, verification, and reviewers. Cites the two contracts above.
