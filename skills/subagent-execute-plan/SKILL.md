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
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*) Bash(git *) Workflow
---

# Subagent-Execute-Plan (Coordinator)

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

This skill is a **coordinator only**. It holds plan state, builds an execution schedule, and dispatches subagents. It never edits files, never runs tests, never reads source code. Subagents do all work.

**Why coordinator-only:** isolated context per subagent → no pollution. The coordinator's context stays small (plan, TaskList, last subagent return) so it can run a long plan without hitting its own context limit. Subagents do the heavy lifting and discard their context when they return.

**Core loop:**

```
plan → explorer (group disjoint tasks) → for each group:
  pick execution strategy (subagents | workflow | workflow-isolated) →   ← Step 3a-S
  ┌─ subagents:          parallel background implementers, same tree ───┐
  ├─ workflow:           one Workflow script, same tree ─────────────────┤
  └─ workflow-isolated:  one Workflow script, per-task worktree ────────┘ →
  if workflow-isolated → merge each task's patch into the shared tree →   ← Step 3c-WI
  decide: tests/lints worth running now? →
  if yes → test-runner / static-analyse subagents →
  if findings → SendMessage original implementer OR spawn bdk:fixer →
  commit group → next group
```

**Three execution paths per group.** A group is dispatched as **hand-orchestrated background subagents** (the default — full SendMessage/re-dispatch control per task), as a **single Workflow** that fans out over the wave deterministically in the shared tree (cheaper coordinator context, better for large disjoint mechanical waves), or as a **worktree-isolated Workflow** (each task gets its own git worktree, so the wave doesn't need proven file-disjointness — the coordinator reconciles afterward). The coordinator chooses per group — see Step 3a-S. Both Workflow paths reuse the **same bdk agent fleet** via `agentType`, so return contracts, rules, and tool tiers are identical; only the orchestration and merge step differ.

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

The coordinator may spawn **multiple implementers in parallel** for a single group when `bdk:explorer` reports the tasks touch disjoint file sets. Same group → same tree (disjoint files = no conflict). When the explorer cannot confirm disjointness but the wave is wide, `workflow-isolated` (Step 3a-S) gives each implementer its own worktree instead — see 3b-WI/3c-WI.

For a `workflow` or `workflow-isolated` group (Step 3a-S / 3b-W / 3b-WI), the same `bdk:implementer` and `bdk:fixer` agents are driven by a `Workflow` script via `agentType` rather than by direct `Agent` calls — identical agents, identical return contract (plus a `patch` field for the isolated variant), deterministic orchestration.

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
     Worktree mode: chosen per group in Step 3a-S (same-tree default; per-task worktree only for workflow-isolated)
     Test/lint cadence: orchestrator judgment per group (max 2 consecutive skips)
   ```

---

## Step 1 — Group planning (prefer the plan's declared waves)

**If the plan has an `## Execution Waves` section** (produced by `/bdk:create-plan`): adopt those waves directly as the parallel groups — they are already computed from the task DAG with disjoint file sets per wave. Spawn `bdk:explorer` once only to **validate**, not re-derive: pass the declared waves plus each task's `Files:`/`Depends on:` and ask it to confirm no same-wave file collision and no missing dependency edge. If the explorer confirms (`confidence ≥ 0.6`, no `warnings`), use the plan's waves as-is — this skips a full re-derivation and is the fast path. If it flags a collision or missing edge, fall back to full re-derivation below and log `[subagent-execute-plan] Plan waves rejected: {reason} — re-deriving`.

**If the plan has no Execution Waves section** (older plan, hand-written): spawn `bdk:explorer` (one foreground call) to derive groups. Pass:

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

### 3a-S. Pick execution strategy (subagents vs. workflow vs. workflow-isolated)

Decide once per group, **before** dispatching, how the group's tasks run. Three strategies:

- **`subagents`** (default) — hand-orchestrated background `Agent` calls, one per task, with full per-task control: SendMessage follow-up, per-task model escalation, `NEEDS_CONTEXT` round-trips. Steps 3a → 3c.
- **`workflow`** — a single `Workflow` script fans out over the whole wave deterministically, all tasks in the shared tree. Cheaper coordinator context (one tool call, not N background agents to track), and the script handles intra-wave parallelism + per-item verification inline. Requires proven file-disjointness (below). Step 3b-W.
- **`workflow-isolated`** — a single `Workflow` script, same as `workflow`, but each task's implementer runs in its own git worktree (`isolation: 'worktree'`) and returns a patch instead of mutating the shared tree directly. Use this when the wave is wide enough to be worth batching but the explorer couldn't confirm disjointness. The coordinator merges patches into the shared tree afterward (Step 3c-WI) — collisions become merge conflicts to resolve, not silent corruption. Step 3b-WI.

**Plan-declared preference (authoritative input).** If the plan's `## Execution Waves` section tags the wave with `strategy: workflow`, `strategy: workflow-isolated`, or `strategy: subagents`, treat that as the declared preference. Adopt it **unless** an override condition below fires — then log the override and its reason.

**Executor override rubric.** The plan tag is a hint, not a mandate. Override toward each strategy when:

| Choose `workflow` when | Choose `workflow-isolated` when | Choose `subagents` when |
|---|---|---|
| Wave has **≥ 4 file-disjoint tasks**, all with full `Test cases:` blocks (mechanical, low-ambiguity) | Wave has **≥ 4 tasks**, explorer flags collision risk (`confidence < 0.6`) but tasks are still logically independent (e.g. several features touching a shared config/index file) | Wave has **≤ 3 tasks**, or any task is architectural / ambiguous / likely to return `NEEDS_CONTEXT` |
| Tasks are uniform (same model tier, no expected escalation) | Tasks are uniform, and a merge-conflict-per-task is an acceptable cost | Tasks need **per-task model escalation** or tight SendMessage iteration |
| Coordinator context is tight and a compact dispatch helps | Coordinator context is tight, wave is too wide to serialize acceptably | A task may need the coordinator to split it mid-flight |
| Explorer `confidence ≥ 0.6` on disjointness | Explorer `confidence < 0.6`, but no task is flagged as truly dependent on another's edits to the *same lines* | Explorer flagged a collision risk **and** the wave has ≤ 3 tasks (isolation overhead isn't worth it) |

**Hard precondition for `workflow`:** the wave's tasks MUST be file-disjoint with `confidence ≥ 0.6` (same rule as parallel implementers — see Rules). If not, prefer `workflow-isolated` when the wave qualifies (≥ 4 tasks); otherwise force `subagents`. A `workflow` (non-isolated) script that mutates colliding files in parallel corrupts the shared tree with no recovery path.

**Precondition for `workflow-isolated`:** wave has **≥ 4 tasks**. Below that, per-task worktree setup + patch reconciliation costs more than the serialization it's meant to avoid — force `subagents` instead. Isolation does not require `confidence ≥ 0.6`; it exists precisely for the sub-0.6 case. It still requires the explorer to have run (no isolation for a wave the explorer couldn't analyze at all — malformed JSON still triggers full serial mode per Step 1's fallback triggers).

**Default when neither plan tag nor rubric is decisive:** `subagents`. It is strictly more controllable; reserve `workflow` and `workflow-isolated` for waves that clearly fit their columns.

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if env.HERDR_ENV=1 --if cmd.herdr --then-text '> **Herdr spawn tier active.** A Workflow script cannot drive Herdr panes, so treat the herdr transport as an argument for the **subagents** strategy: override a plan-declared workflow strategy toward subagents unless the wave is wide enough (5+ tasks) that the pane cap would force batching anyway. Log the override reason as override:herdr-transport. Pane cap and transport details: "Spawn Tier: Herdr Pane Agents" in the BDK foundation.'`

Record the chosen strategy per group in coordinator state and surface the counts in the Step 4e summary (`groups_via_workflow`, `groups_via_workflow_isolated`, `groups_via_subagents`). Log the decision:

```
[subagent-execute-plan] Group {N} strategy: {workflow|workflow-isolated|subagents} ({declared|override:<reason>|default})
```

> A single-task group is never worth a Workflow — the script overhead exceeds one `Agent` call. Force `subagents` for any group with one task.

### 3a. Pick implementer model per task

> Steps 3a, 3b, and 3c apply to the **`subagents`** strategy. For a **`workflow`** group, skip to **3b-W**. For a **`workflow-isolated`** group, skip to **3b-WI**, then **3c-WI** (merge). All three paths converge at **3d** (verification).

| Task profile | Model |
|---|---|
| 1–2 files, mechanical, full spec | `haiku` |
| Cross-file, integration, refactor | `sonnet` (default) |
| Architectural decision, broad surface, ambiguous spec | `opus` |
| Re-dispatch after `BLOCKED` due to reasoning gap | escalate one tier |

See `references/model-selection.md`.

### 3b. Dispatch implementers (parallel if group has >1 task)

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if env.HERDR_ENV=1 --if cmd.herdr --then-text '> **Herdr spawn tier active.** Dispatch implementers as Herdr pane agents instead of Agent calls, up to 4 concurrent (waves wider than 4 split into consecutive pane batches). Everything else in this step is unchanged: same dispatch payload, same YAML envelope, now written to a file. Step 3c status handling reads that file, and NEEDS_CONTEXT uses a continuation prompt in place of SendMessage. When the wave is not file-disjoint, give each pane its own herdr worktree rather than serialising. Full procedure and fallback triggers: "Spawn Tier: Herdr Pane Agents" in the BDK foundation. Record the transport in the Step 4e summary.'`

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

### 3b-W. Dispatch group as a Workflow (when 3a-S chose `workflow`)

Invoke the **`Workflow`** tool with one self-contained script that fans out over the wave's tasks. The script reuses the bdk fleet via `agentType` — no new return contract.

**Authoring rules for the script:**

- **One `meta` block** (pure literal): `name: 'execute-wave-{N}'`, a one-line `description`, and `phases` matching the `phase()` calls below.
- **`pipeline()` over the tasks**, not `parallel()` — each task flows implement → (optional) verify independently, no barrier. Pass the per-task data (full task text, `Test cases:` block, file paths, branch, `BASE_SHA`) as the `args` input — never make the script re-read the plan.
- **Stage 1 — implement:** `agent(prompt, { agentType: 'bdk:implementer', phase: 'Implement', schema: RETURN_SCHEMA })`. The schema is a JSON-Schema transcription of the YAML return contract (`references/return-contract.md`): `status` enum `DONE|DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED`, `files_changed[]`, `concerns[]`, `reason`. Pick the model per task with the same matrix as 3a via `model:`.
- **Stage 2 — fix (conditional):** if a task returns `DONE_WITH_CONCERNS` with a correctness concern or `BLOCKED`, route it to `agent(..., { agentType: 'bdk:fixer', phase: 'Fix', schema: RETURN_SCHEMA })` inside the same pipeline item. A task that stays `BLOCKED` after one fixer attempt resolves to `null` for that item — do not loop inside the script.
- **No nested verification inside the script for tests/lint** — the coordinator still owns 3d–3f. The script returns the union of `files_changed` and any unresolved `BLOCKED`/`NEEDS_CONTEXT` items.
- **No commit inside the script** — the coordinator commits in 3g. The Workflow only implements + optionally fixes.

The script returns `{ files_changed: [...], blocked: [...], needs_context: [...] }` (return a plain object from the script body). The coordinator:

- Records `files_changed` (feeds 3d/3e/3g exactly like the subagent path).
- For any `needs_context` or `blocked` item the script could not resolve → fall back to the **subagent path** for that single task (3b with one `Agent` call, full SendMessage control). The Workflow is for the bulk; stragglers get hand-orchestration. Count each such fallback as an `implementer_redispatch`.

**Cap:** a wave gets **one** Workflow invocation. If the returned `blocked` set is non-empty after the per-task subagent fallback, apply the existing per-task 3-cycle cap. Three+ blocked tasks in one wave that survive fallback → stop the skill with an error report (the wave was mis-classified as `workflow`-suitable; note this in the error so the plan tag can be corrected).

See `references/dispatch-templates.md` → "Workflow wave dispatch" for the script skeleton and the `RETURN_SCHEMA` literal.

After the Workflow (and any fallbacks) settle, proceed to **3d** with the merged `files_changed`.

### 3b-WI. Dispatch group as an isolated Workflow (when 3a-S chose `workflow-isolated`)

Same script shape as 3b-W, with two differences: each implementer call sets `isolation: 'worktree'`, and implementers **never mutate the coordinator's shared tree** — they return a patch instead of relying on the coordinator's later `git add`/`git commit` seeing their edits directly.

**Authoring rules, delta from 3b-W:**

- **Stage 1 — implement:** `agent(prompt, { agentType: 'bdk:implementer', phase: 'Implement', isolation: 'worktree', schema: ISOLATED_RETURN_SCHEMA })`. `ISOLATED_RETURN_SCHEMA` extends the normal return contract with one additional required field on `DONE` / `DONE_WITH_CONCERNS`: `patch` (string) — the unified diff of the implementer's own worktree, produced with `git diff` (and `git diff --cached` if it staged anything) before returning. The dispatch prompt adds: "Before returning, run `git diff` in your working directory and include the full output verbatim as the `patch` field. Do not commit — the coordinator applies your patch."
- **Stage 2 — fix (conditional):** identical to 3b-W, `agentType: 'bdk:fixer'`, same worktree, same `patch`-on-return rule.
- **No commit inside the script, same as 3b-W** — plus, critically, no commit **inside the isolated worktree either**. A subagent-authored commit would break the single commit-boundary invariant (Rules) and complicate the merge in 3c-WI, which expects a plain patch, not a ref to cherry-pick.
- The script returns `{ files_changed: [...], patches: [{ task_id, patch }], blocked: [...], needs_context: [...] }` — one `patch` entry per successfully implemented task, in task order.

Worktrees created by the `Workflow` tool are ephemeral to that tool call; the coordinator never references their paths or branches directly, only the returned `patch` strings. This keeps the isolation invisible to everything downstream of 3c-WI.

### 3c-WI. Merge isolated patches into the shared tree

For each entry in `patches`, **in task-number order** (deterministic — not return order):

1. `git apply --3way` the patch onto the coordinator's shared working tree.
2. **Clean apply** → continue to the next patch.
3. **Conflict** (non-zero exit, or conflict markers left in the tree) → spawn `bdk:fixer` once with: the failing patch, the conflicting file's current content, and the original task text. The fixer resolves in the shared tree directly (it has `Edit`/`Write`) and reports `DONE`/`BLOCKED` — no isolation for the fixer, it's operating on the one tree everything else already shares.
4. **Fixer resolves** → continue to the next patch.
5. **Fixer reports `BLOCKED`** (or a second conflict) → `git checkout -- <affected files>` to revert the failed apply attempt, then fall back to a single hand-orchestrated implementer for that task **on the current state of the shared tree** (existing 3b path, foreground is fine — the rest of the wave already landed or is waiting). Count as `implementer_redispatch` and log `[subagent-execute-plan] Group {N} task {task_id}: isolated patch conflict, resolved via {fixer|fallback-implementer}`.

Three or more patch conflicts that require the step-5 fallback in one wave → stop the skill with an error report (the wave was mis-classified as `workflow-isolated`-suitable; note this so the plan tag can be corrected, same as the 3+ blocked-task cap in 3b-W).

After all patches are applied or reconciled, proceed to **3d** with the union of `files_changed` (declared) reconciled against `git diff --name-only` against the pre-merge tree state — same reconciliation 3g already does at commit time, just run once more here so 3d–3f see the true diff.

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
groups_via_workflow: {W}
groups_via_workflow_isolated: {WI}
groups_via_subagents: {S}
isolated_patch_conflicts: {N}
spawn_transport: agent|herdr|mixed
spawn_fallbacks: {N}
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

- Coordinator never edits files, runs tests, runs lint, or reads source. It runs `git` (status, rev-parse, diff, add, commit, and — for `workflow-isolated` merges only — apply, checkout) and dispatches subagents (directly, or via a `Workflow` script for a `workflow`/`workflow-isolated`-strategy group).
- Spawn transport is chosen by the foundation's spawn tier, not by this skill: when the Herdr tier is active, dispatch via pane agents and fall back to `Agent` calls on that tier's triggers. Transport never changes the return contract, the verification schedule, or the commit boundary. Surface it as `spawn_transport` in the Step 4e summary.
- Execution strategy is chosen per group in Step 3a-S: plan-declared `strategy:` tag is authoritative input, the executor override rubric may flip it, default is `subagents`. A `workflow` group requires file-disjoint tasks at `confidence ≥ 0.6` and >1 task. A `workflow-isolated` group requires ≥ 4 tasks but not proven disjointness — otherwise force `subagents` (or `workflow` if disjointness IS proven).
- The `Workflow` script implements + optionally fixes only. Verification (3d–3f) and commits (3g) stay with the coordinator. Unresolved `BLOCKED`/`NEEDS_CONTEXT` items from a Workflow fall back to a single hand-orchestrated implementer each.
- `workflow-isolated` implementers/fixers never commit inside their worktree and never touch the coordinator's shared tree directly. They return a `patch`; only the coordinator applies it (3c-WI), preserving the single commit-boundary invariant. A patch conflict is resolved by `bdk:fixer` operating on the shared tree, not by re-running the isolated agent.
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
- ❌ Choosing the `workflow` strategy for a group whose tasks are not file-disjoint at `confidence ≥ 0.6`. The script runs them concurrently — collisions corrupt the shared tree with no recovery. Use `workflow-isolated` (if ≥ 4 tasks) or force `subagents`.
- ❌ Choosing `workflow-isolated` for a wave with < 4 tasks. Per-task worktree setup plus patch reconciliation costs more than the serialization it exists to avoid — use `subagents`.
- ❌ Using `workflow` or `workflow-isolated` for a single-task group, an ambiguous/architectural task, or one likely to need `NEEDS_CONTEXT` round-trips. Neither script can SendMessage mid-flight — use `subagents`.
- ❌ Letting a `workflow-isolated` implementer or fixer commit inside its own worktree, or having the coordinator cherry-pick/merge a worktree branch directly. The contract is patch-in, patch-applied-by-coordinator — never a subagent-authored commit landing on the shared branch.
- ❌ Committing or running tests/lint inside the Workflow script (either variant). The script implements + fixes only; the coordinator owns 3c-WI (isolated merge) and 3d–3g.
- ❌ Looping a Workflow more than once per wave to chase blocked tasks. One invocation; stragglers fall back to hand-orchestrated subagents.
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
- `references/dispatch-templates.md` — exact dispatch prompts for explorer, implementer, fixer, verification, and reviewers, plus the **Workflow wave dispatch** script skeleton + `RETURN_SCHEMA` for the `workflow` strategy, and the **isolated Workflow wave dispatch** skeleton + `ISOLATED_RETURN_SCHEMA` (adds the `patch` field) for `workflow-isolated`. Cites the two contracts above.
