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
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*) Bash(git *) Bash(cat ${CLAUDE_PLUGIN_ROOT}/skills/cr/references/*) Workflow
disallowed-tools: AskUserQuestion
---

# Subagent-Execute-Plan (Coordinator)

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

This skill is a **coordinator only**. It holds plan state, builds an execution schedule, and dispatches subagents. It never edits files, never runs tests, never reads source code. Subagents do all work.

The coordinator's own mechanical work — `git add`, `git commit`, and every state mutation — goes through git and `scripts/bdk_run_state.py`. Those are judgment-free bookkeeping, not editing.

**Why coordinator-only:** isolated context per subagent → no pollution. The coordinator's context stays small (a slice of the plan, the run manifest, the last subagent return) so it can run a long plan without hitting its own context limit. Subagents do the heavy lifting and discard their context when they return.

**Where run state lives.** The plan file is immutable: its sha256 is the run's identity. Progress lives in two places:

- **Git commit trailers** (`BDK-Run:`, `BDK-Group:`) — the durable ground truth. They survive a crash, a fresh session, a deleted `.bdk/`, and a rebase.
- **A run manifest** at `.bdk/runs/<run-id>.json` — a cache that makes resume cheap.

Both are mediated by `scripts/bdk_run_state.py`, the only thing that reads or writes the manifest. When the two disagree, git wins and the script corrects the manifest. Never read or write that JSON directly.

**Core loop:**

```
plan → explorer (group disjoint tasks) → for each group:
  pick execution strategy (subagents | workflow) →           ← Step 3a-S
  ┌─ subagents: parallel background implementers ───┐
  └─ workflow:  one Workflow script over the wave ──┘ →
  decide: tests/lints worth running now? →
  if yes → test-runner / static-analyse subagents →
  if findings → SendMessage original implementer OR spawn bdk:fixer →
  commit group → next group
```

**Two execution paths per group.** A group is dispatched either as **hand-orchestrated background subagents** (the default — full SendMessage/re-dispatch control per task) or as a **single Workflow** that fans out over the wave deterministically (cheaper coordinator context, better for large disjoint mechanical waves). The coordinator chooses per group — see Step 3a-S. The Workflow path reuses the **same bdk agent fleet** via `agentType`, so return contracts, rules, and tool tiers are identical; only the orchestration differs.

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

For a `workflow`-strategy group (Step 3a-S / 3b-W), the same `bdk:implementer` and `bdk:fixer` agents are driven by a `Workflow` script via `agentType` rather than by direct `Agent` calls — identical agents, identical return contract, deterministic orchestration.

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
5. **Check the verification stamp.** Read `.bdk/verify-plan/<plan-slug>-verification.md`. Compare the `Plan sha256:` it records against `bdk_run_state.py hash-plan {plan-path}`.

   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py hash-plan {plan-path}
   ```

   | Stamp | Meaning | Action |
   |---|---|---|
   | present, hash matches | this exact plan was verified | `stamped` |
   | present, hash differs | the plan changed after verification | `stale` |
   | absent | never verified | `missing` |

   `stale` and `missing` **warn and continue**. Do not stop: skipping verification is the user's call to make, and blocking here would make the executor unusable on a hand-written plan. Report the verdict on the `Verification:` line of the summary below so it is visible rather than buried in a warning.

6. **Register the run.** Compute the run id, then `init`:

   ```bash
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py run-id --plan {plan-path}
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py init \
     --run {run-id} --plan {plan-path} \
     --base-sha $(git merge-base HEAD origin/HEAD || git merge-base HEAD main) \
     --session ${CLAUDE_SESSION_ID}
   ```

   `init` is the resume path too — it is idempotent. It returns `resumed`, `groups_done`, `base_sha`, and `notes`.

   - **`resumed: false`** → fresh run. Spawn `bdk:explorer` for groups (Step 1).
   - **`resumed: true`** → run `resume` to get `next_group`, then spawn `bdk:explorer` for groups (the grouping is not persisted; it is re-derived from the immutable plan, which cannot have changed without `init` warning about it) and skip forward to `next_group`.
   - **Refusal naming another session** → that run is held elsewhere. Report the message verbatim and stop. Re-invoke with `--force` **only** when the user confirms the other session is gone; `--force` prints exactly what it took over.
   - **Any `notes`** → print them. They cover a `.gitignore` that had to be written, a changed plan file, and groups recovered from git that the manifest had lost.

   The base SHA is a merge-base, not `HEAD`: it must stay fixed for the life of the run, since Step 4a reviews `base_sha..HEAD` and `resolve-range` anchors deltas to it. It lives in the manifest rather than a coordinator variable so a crash cannot lose the review baseline.

7. **Print summary:**

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
   ```

   `{source}` names where the grouping came from and is never omitted: `(plan waves, validated)`, `(explorer-derived)`, or `(serial: {reason})` when Step 1 fell back. A bare group count cannot distinguish a genuinely serial plan from a failed grouping - see Step 1.

---

## Step 1 — Group planning (prefer the plan's declared waves)

**If the plan has an `## Execution Waves` section** (produced by `/bdk:create-plan`): adopt those waves directly as the parallel groups — they are already computed from the task DAG with disjoint file sets per wave. Spawn `bdk:explorer` once only to **validate**, not re-derive: pass the declared waves plus each task's `Files:`/`Depends on:`, point it at the contract (see the dispatch line below), and ask it to confirm no same-wave file collision and no missing dependency edge. If the explorer confirms (`confidence ≥ 0.6`, no `warnings`), use the plan's waves as-is — this skips a full re-derivation and is the fast path. If it flags a collision or missing edge, fall back to full re-derivation below and log `[subagent-execute-plan] Plan waves rejected: {reason} — re-deriving`.

**If the plan has no Execution Waves section** (older plan, hand-written): spawn `bdk:explorer` (one foreground call) to derive groups. Pass:

- The list of tasks (number, title, file paths declared in plan).
- The repo root.
- This line, so the explorer reads the contract itself rather than receiving a copy of it:

  ```
  Read ${CLAUDE_PLUGIN_ROOT}/skills/subagent-execute-plan/references/explorer-contract.md
  and return exactly the JSON envelope it defines - that schema overrides your
  default output format. Follow its grouping rules and confidence calibration.
  ```

The explorer returns the JSON envelope defined in `references/explorer-contract.md`: `confidence` (float), `groups[]` (ordered, each with `tasks` + `rationale`), `warnings[]`.

Both dispatches (validate and derive) carry that line. It replaces pasting the schema inline, which was the previous instruction and had two failure modes: the paste was 2.5 KB of prompt inviting a well-meant "shorten this", and it competed against the explorer's own default output format, so a shortened paste silently produced prose instead of JSON. A pointer to the one source of truth cannot drift from it, and `agents/explorer.md` states that a caller-specified schema wins - so the override is the agent's own rule, not something the prompt has to out-shout.

**Fallback triggers** (any → full serial mode, every task its own group): malformed JSON, `confidence < 0.6`, or any group referencing an undefined task id.

Serial mode is safe but slow - a 12-task plan becomes 12 groups, so 12 dispatch/verify/commit cycles instead of 4. It is never entered silently. Print the reason and carry it into the Step 0.7 summary:

```
[subagent-execute-plan] Explorer grouping rejected: {reason} - full serial mode ({N} groups)
```

See `references/explorer-contract.md` for the `reason` wording per trigger, the full grouping rules, and the confidence calibration hints.

---

## Step 2 — Hold the schedule in context

There is nothing to build. Group membership comes from the immutable plan (or the explorer's derivation of it) and progress comes from the manifest, so the schedule needs no separate mirror — and a mirror is exactly what would drift.

Keep the group list in context for the run and announce each transition:

```
[subagent-execute-plan] Group {n}/{G}: tasks {ids} — dispatching
[subagent-execute-plan] Group {n}/{G}: committed {short-sha}
```

Ad-hoc dispatches inside a group (verify-batch, fix-lint, fix-test) are not tracked anywhere. They are transient: their result either lands in the group's commit or turns into a `BLOCKED` stop. Only **group** completion is durable state, and it is recorded once, at commit time, in Step 3h.

---

## Step 3 — Per-group loop

For each group in order:

### 3a-S. Pick execution strategy (subagents vs. workflow)

Decide once per group, **before** dispatching, how the group's tasks run. Two strategies:

- **`subagents`** (default) — hand-orchestrated background `Agent` calls, one per task, with full per-task control: SendMessage follow-up, per-task model escalation, `NEEDS_CONTEXT` round-trips. Steps 3a → 3c.
- **`workflow`** — a single `Workflow` script fans out over the whole wave deterministically. Cheaper coordinator context (one tool call, not N background agents to track), and the script handles intra-wave parallelism + per-item verification inline. Step 3b-W.

**Plan-declared preference (authoritative input).** If the plan's `## Execution Waves` section tags the wave with `strategy: workflow` or `strategy: subagents`, treat that as the declared preference. Adopt it **unless** an override condition below fires — then log the override and its reason.

**Executor override rubric.** The plan tag is a hint, not a mandate. Override toward each strategy when:

| Choose `workflow` when | Choose `subagents` when |
|---|---|
| Wave has **≥ 4 file-disjoint tasks**, all with full `Test cases:` blocks (mechanical, low-ambiguity) | Wave has **≤ 3 tasks**, or any task is architectural / ambiguous / likely to return `NEEDS_CONTEXT` |
| Tasks are uniform (same model tier, no expected escalation) | Tasks need **per-task model escalation** or tight SendMessage iteration |
| Coordinator context is tight and a compact dispatch helps | A task may need the coordinator to split it mid-flight |
| Explorer `confidence ≥ 0.6` on disjointness (Workflow runs tasks concurrently — collisions are unrecoverable mid-script) | Explorer flagged any collision risk for the wave |

**Hard precondition for `workflow`:** the wave's tasks MUST be file-disjoint with `confidence ≥ 0.6` (same rule as parallel implementers — see Rules). If not, force `subagents`. A Workflow that mutates colliding files in parallel corrupts the worktree with no recovery path.

**Default when neither plan tag nor rubric is decisive:** `subagents`. It is strictly more controllable; reserve `workflow` for waves that clearly fit the left column.

Record the chosen strategy per group in coordinator state and surface the counts in the Step 4e summary (`groups_via_workflow`, `groups_via_subagents`). Log the decision:

```
[subagent-execute-plan] Group {N} strategy: {workflow|subagents} ({declared|override:<reason>|default})
```

> A single-task group is never worth a Workflow — the script overhead exceeds one `Agent` call. Force `subagents` for any group with one task.

### 3a. Pick implementer model per task

> Steps 3a, 3b, and 3c apply to the **`subagents`** strategy. For a **`workflow`** group, skip to **3b-W**; the script handles model selection and dispatch internally. Both paths converge at **3d** (verification).

| Task profile | Model |
|---|---|
| 1–2 files, mechanical, full spec | `haiku` |
| Cross-file, integration, refactor | `sonnet` (default) |
| Architectural decision, broad surface, ambiguous spec | `opus` |
| Re-dispatch after `BLOCKED` due to reasoning gap | escalate one tier |

See `references/model-selection.md`.

### 3b. Dispatch implementers (parallel if group has >1 task)

For a multi-task group, send **one message with multiple `Agent` calls**. Each call passes:

- Full task text inline (do not make subagent re-read the plan)
- Test cases block
- File paths the task touches
- One-paragraph architectural context
- Branch name and the run's `base_sha` (the value `get`/`resume` returned in Step 0.6 - read it from the manifest, never re-derive it, or a mid-run branch move silently shifts the baseline)
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
| `BLOCKED` | Diagnose: bad context → SendMessage; reasoning gap → spawn fresh implementer one model tier up; task too large → split it in context and re-dispatch the first slice (the plan is immutable, so the split lives in the coordinator's head for this group only and is not recorded anywhere); plan wrong → log and stop with explicit error. |
| (malformed return) | Treat as `BLOCKED` with reason "malformed return." Re-dispatch fresh, same tier. |

Max 3 re-dispatch cycles per task before stopping the whole skill with an error report.

> Re-dispatch ≠ fresh spawn. For `NEEDS_CONTEXT` and small clarifications, prefer `SendMessage(to: "<agent_id>", ...)` — the implementer keeps its prior reasoning. Spawn fresh only when escalating model tier. See STARTUP "Continuing a Spawned Agent".

### 3b-W. Dispatch group as a Workflow (when 3a-S chose `workflow`)

Invoke the **`Workflow`** tool with one self-contained script that fans out over the wave's tasks. The script reuses the bdk fleet via `agentType` — no new return contract.

**Authoring rules for the script:**

- **One `meta` block** (pure literal): `name: 'execute-wave-{N}'`, a one-line `description`, and `phases` matching the `phase()` calls below.
- **`pipeline()` over the tasks**, not `parallel()` — each task flows implement → (optional) verify independently, no barrier. Pass the per-task data (full task text, `Test cases:` block, file paths, branch, the manifest's `base_sha`) as the `args` input — never make the script re-read the plan.
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
- `bdk:test-runner` — pass the group's `files_changed`, scoped to the project's fast/unit-tier test command only (per `.bdk/settings.json` `test-tools`). If the group added or modified spec files belonging to a slower e2e/integration-tier test command, also pass those exact spec paths for that tier. **Never fall back to a bare full-suite invocation of any tier here** — if scoping isn't obvious, ask `bdk:explorer` which test files cover the changed paths rather than defaulting to "run everything." The one and only full-suite run happens once, at 4d.

Both background. Wait for both.

**Record verifier `agentId`s** in per-group coordinator state (alongside `files_changed`) for SendMessage reuse in 3f. The recorded ids are scoped to **this group only** — never reuse a verifier across groups, since each group has a different `files_changed` set and reusing would poison context.

### 3f. Handle verification results

For each failure (lint or test):

- If the failure clearly belongs to one task and that task's implementer agent is still alive (cache warm, <5 min) → `SendMessage` to that implementer with the findings. It already has the file context. Cheap fix.
- Otherwise → spawn a fresh `bdk:fixer` subagent with the findings inline.

After fixers/SendMessage rounds return → **re-engage the same verifiers** via `SendMessage(to: <verifier_agent_id>, …)` recorded in 3e, passing only the new diff / changed files. The cache should still be warm (typically <5 min). If `SendMessage` errors (agent gone) or the cache window has expired → spawn fresh and increment a `verifier_cache_misses` counter (surfaced in Step 4e). Up to 3 verify-fix cycles per group. After 3 unsuccessful cycles → stop with error.

> Verifiers are stateless w.r.t. project semantics — they execute a command and report. Reuse saves the model's cold-start prompt without semantic risk. See STARTUP "Continuing a Spawned Agent" for the cache-window rules.

### 3g. Commit group

The coordinator is the **only** committer. Implementers and fixers leave their work uncommitted; if you find a subagent committed anyway, that is a bug in its prompt — reconcile and continue, then report it.

When the group passes verification (or was skipped per 3d):

1. **Reconcile declared-vs-actual files.** Run `git diff --name-only HEAD` (the tree is clean at every group boundary, so `HEAD` is the previous group's commit, or `base_sha` for the first group) and compare to the union of `files_changed` returned by implementers. Log any mismatch as a warning (scope creep or undeclared edits) but proceed.
2. Stage exactly the files in the actual diff for this group, and commit **with the run trailers**:

   ```bash
   git add <reconciled-file-list>
   git commit -m "<group summary>" \
     --trailer "BDK-Run={run-id}" \
     --trailer "BDK-Group={n}"
   ```

   Use `--trailer`, never repeated `-m`. Git parses only the **last** paragraph of a message as trailers, so `-m "BDK-Run: …" -m "BDK-Group: …"` produces two separate paragraphs and git recognises at most one of them as a trailer. The failure is silent: the commit looks right to a human and is invisible to `bdk_run_state.py`.

   These trailers are what makes the run survivable. They are the only record that outlives a deleted manifest or a rebase, and `resolve-range` recovers a rewritten review boundary from `BDK-Group` alone. A group committed without them cannot be recovered.

### 3h. Record the group

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py group-done \
  --run {run-id} --group {n} --commit HEAD
```

One call per **group**, never per task — this is the only per-group state mutation, and keeping it at group granularity is what keeps the bookkeeping off the critical path.

If the result carries a note about a missing trailer, the commit in 3g was made wrong. Fix the commit (`git commit --amend --trailer …`) and re-run `group-done` before moving on, rather than continuing with an unrecoverable group.

Continue to the next group.

---

## Step 4 — End-of-plan review

All groups committed → run **once**, organized in two phases. Phase A converges code-review findings; Phase B runs architecture review and final tests **in parallel**.

### Phase A — Code review + triage

#### 4a. Run the review engine

Read the engine now, not earlier - this is the one place in the run that needs it, and Step 0 through Step 3 have no use for it:

```bash
cat ${CLAUDE_PLUGIN_ROOT}/skills/cr/references/review-engine.md
```

Following that reference is **not** invoking `/bdk:cr`. The Rules section below forbids subagent-spawning skills *inside subagents*; you are the coordinator, and reading a reference doc spawns nothing. `cr` owns the engine because it is the skill whose whole purpose is review; you are the second caller of the same logic, and there is exactly one copy of it on purpose.

Fill the request:

```
mode:        autonomous
run_id:      {run-id}
base_sha:    {manifest base_sha}
head_sha:    $(git rev-parse HEAD)
range_mode:  full
group:       null
scaling:     from the resolved range
focus:       null
```

`range_mode: full` because this is the end-of-plan pass: a later group can break an earlier, already-reviewed one, so the whole `base_sha..HEAD` range is in scope. The engine's caller-specific skips apply - do **not** dispatch `bdk:static-analyse` or `bdk:test-runner` here. You ran them per group at 3e and run the full suite once at 4d; a third pass buys nothing and doubles the review's wall-clock.

The engine returns a flat findings array. You do not render the 13-section report - that is `cr`'s output shape. Triage the array instead.

#### 4b. Triage findings

- `CRITICAL` / `HIGH` → spawn `bdk:fixer` per finding batch (group by file or by severity). The fixer leaves its work uncommitted; commit it yourself with the trailers of the group being fixed, then re-spawn `bdk:code-reviewer`.
- `MEDIUM` / `LOW` → record each one:

  ```bash
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py findings-add \
    --run {run-id} --severity MEDIUM --category {cat} \
    --file {path} --line {n} [--symbol {name}] --problem {one-line summary}
  ```

  Triage the **merged** array from the engine's Step 4, never the raw agent outputs: the merge collapses one defect reported by several reviewers into one finding. Batching fixers off the raw outputs sends two fixers at one function. Pass `--symbol` whenever the merged finding carries one, and `--category` as one of the engine's ten slugs.

  Do not auto-fix — risk of overcorrection on debatable findings. Recording them is what stops the next review pass from re-reporting findings you deliberately declined: `findings-list --format prompt` emits the suppression block for the next reviewer prompt.

Up to 2 review-fix cycles. Remaining `CRITICAL` after cycle 2 → stop with error.

Once Phase A converges, record the watermark:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bdk_run_state.py review-done \
  --run {run-id} --reviewed-sha $(git rev-parse HEAD) \
  --counts {C},{H},{M},{L}
```

After a fixer round, `HEAD` has moved - pass the sha you actually reviewed last, which is the post-fix `HEAD`. The script refuses the literal string `HEAD` and refuses any sha that is not a descendant of the current watermark; both refusals mean the range was wrong, so fix the call rather than working around it.

### Phase B — Parallel final pass (architecture review || final tests)

Once Phase A converges, dispatch the final two checks in a **single coordinator message with two `Agent` calls**. Wait for both completion notifications before moving to 4e - do not poll or schedule wake-ups. Their failure paths are independent — each runs its own fixer cycles.

#### 4c. `bdk:architecture-reviewer` (conditional)

Spawn only if **any** of:

- Plan touched ≥ 3 modules
- Plan introduced new layers, public APIs, or cross-module dependencies
- Any task had architectural surface (judgment call from plan text)

Dispatch it per the engine's cumulative cohort: pass `cumulative_files`, the whole `base_sha..HEAD` set, never a delta. A layer violation is a property of the branch, so a delta-scoped architecture review reports clean while the violation stands. Prompt structure in `${CLAUDE_PLUGIN_ROOT}/skills/cr/references/reviewer-prompt-template.md`.

Findings handled like 4b: `CRITICAL` / `HIGH` → `bdk:fixer`, then re-spawn `bdk:architecture-reviewer`. Up to 2 review-fix cycles.

If none of the conditions hold, **skip** the spawn — log `architecture_review: skipped:<reason>` in the summary. Phase B then degenerates to just the final test-runner.

#### 4d. Final `bdk:test-runner` (full suite)

The only point in this skill where a bare, unscoped full-suite command runs for **every** tier in `test-tools`, including slower e2e/integration ones — deliberately placed here, after Phase A's code review has already converged, not per-group. Do not move this earlier or add an equivalent full-suite fallback elsewhere in this skill.

Must pass. On failure, spawn `bdk:fixer` with failures, re-run. Up to 3 cycles.

**Independence:** architecture-reviewer is read-only (source + graph); test-runner is read-only (executes test commands). They cannot race on shared state. Fixer dispatches from either path are serialized through the existing 3-cycle cap and do not interleave across the two failure pipelines.

### 4e. Print summary, stop

Output exactly this fenced block. No parser consumes it today - it is a stable contract for a future one, and a fixed shape a human can diff between runs. Keys are stable; values are scalars or short comma-lists. Do not add keys on the assumption something reads them.

```
[subagent-execute-plan-summary]
plan: {path}
run: {run-id}
manifest: .bdk/runs/{run-id}.json
base_sha: {short-sha}
head_sha: {short-sha}
tasks_completed: {N}
groups_committed: {G}
groups_via_workflow: {W}
groups_via_subagents: {S}
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

`review_medium_logged` and `review_low_logged` come from `findings-list --run {run-id}`, not from your own recollection of Phase A - the manifest is the record, and counting from context is how the two drift.

The coordinator does not push or open PRs. That belongs to a downstream skill (`/bdk:commit`, the user's PR workflow).

---

## Context-stop policy

The coordinator monitors its own context usage between groups (not mid-group — never abandon in-flight subagents).

- **Threshold:** **≥ 50%** of coordinator context used at the boundary between two groups → finish the in-flight group (commit per 3g), do **not** dispatch the next group.
- **Action:**
  1. Nothing to save. The last group's commit and its `group-done` call already made the run resumable - that is the point of committing per group instead of at the end.
  2. Print the paused summary block:

     ```
     [subagent-execute-plan-paused]
     plan: {path}
     run: {run-id}
     manifest: .bdk/runs/{run-id}.json
     reason: context_stop
     threshold_pct: 50
     context_used_pct: {observed}
     groups_committed: {G}
     groups_remaining: {R}
     resume: /bdk:subagent-execute-plan {plan-path}
     ```
  3. Stop.
- **Resume:** Re-invoke `/bdk:subagent-execute-plan {plan-path}`. Step 0.6 reads the manifest, reconciles it against the commit trailers, and returns the first group with no `BDK-Group` trailer of its own. A resume in a **new session** hits the session guard: the manifest still holds the dead session's id, so pass `--force` to take the run over (`init` prints what it took over, so the takeover is visible rather than silent).

**Why 50%:** the coordinator's context is the plan slice plus the last subagent return envelope - light per tick, but a long plan is many ticks, and the coordinator must have room left to *finish* a group after the boundary check, including a fixer round it did not anticipate. Stopping at half leaves that room. This is a documented constant, not user-tunable in this version; revisit if reports come in.

The threshold actually used this run is surfaced in the Step 4e summary as `context_stop_pct: 50`.

---

## User-interrupt contract

Skill is autonomous, but not uninterruptible. If the user sends a message mid-run:

1. Finish any **in-flight** subagents (do not cancel — they may already hold dirty state).
2. Do **not** dispatch the next group.
3. If the in-flight group completed and passed verification, commit it per 3g and record it per 3h. If it did not, leave the work in the tree and say exactly that, naming the files. Do **not** discard it yourself - that is the user's call, not yours. Point out that Step 0's clean-tree precondition means the next run cannot start until they either keep the work (`git commit`, but then it belongs to no group and the run's ranges will not account for it) or drop it (`git checkout -- .`), and that dropping is the clean option since the next run re-does that group from scratch.
4. Surface the user's message + current progress (including the run id and which group is incomplete), then stop.

The next `/bdk:subagent-execute-plan {plan-path}` invocation resumes via Step 0.6.

---

## Rules

- Coordinator never edits files, runs tests, runs lint, or reads source. It runs `git` (status, rev-parse, diff, add, commit), calls `scripts/bdk_run_state.py`, and dispatches subagents (directly, or via a `Workflow` script for a `workflow`-strategy group). Those two command families are the same category: mechanical, deterministic, no judgment about code.
- Run state is never edited by hand. Every read and write of `.bdk/runs/` goes through `bdk_run_state.py`; the manifest is a cache and the commit trailers are the ground truth, so a hand-edit desyncs from git and is silently overwritten on the next reconcile.
- Execution strategy is chosen per group in Step 3a-S: plan-declared `strategy:` tag is authoritative input, the executor override rubric may flip it, default is `subagents`. A `workflow` group requires file-disjoint tasks at `confidence ≥ 0.6` and >1 task — otherwise force `subagents`.
- The `Workflow` script implements + optionally fixes only. Verification (3d–3f) and commits (3g) stay with the coordinator. Unresolved `BLOCKED`/`NEEDS_CONTEXT` items from a Workflow fall back to a single hand-orchestrated implementer each.
- Implementer subagents **do not** run final lint or test verification. They do TDD red-green for their own task and stop. Verification is a separate subagent the coordinator schedules.
- Parallel implementers are allowed only when `bdk:explorer` confirms file-disjoint sets within the group AND `confidence ≥ 0.6`.
- For verification failures: try `SendMessage` to the original implementer first if cache likely warm and scope is narrow. Fall back to spawning `bdk:fixer`.
- Verifiers (`bdk:static-analyse`, `bdk:test-runner`) are reused via `SendMessage` across verify-fix cycles **within a group**; fresh spawn only on cache miss. Never reuse verifiers across groups — each group's `files_changed` set differs.
- Subagents may invoke skills (e.g. `/bdk:test-driven-development`) but cannot spawn nested subagents. Skills that themselves spawn subagents (`/bdk:cr`, `/bdk:debug`) are forbidden inside subagents — the coordinator handles those flows directly.
- Reviewer findings → fixer subagent. Coordinator never patches code itself.
- Max 3 re-dispatch cycles per task. Max 3 verify-fix cycles per group. Max 2 review-fix cycles at end-of-plan. Max 2 consecutive groups skipping verification.

---

## Anti-patterns

- ❌ Coordinator running `Edit`, `Write`, or test commands. Coordinator dispatches; subagents act.
- ❌ Implementer running final `npm test` / `pytest` / lint as part of its task. That belongs to dedicated verification subagents.
- ❌ Spawning parallel implementers without an explorer pass — silent file conflicts.
- ❌ Choosing the `workflow` strategy for a group whose tasks are not file-disjoint at `confidence ≥ 0.6`. The script runs them concurrently — collisions corrupt the worktree with no recovery. Force `subagents`.
- ❌ Using `workflow` for a single-task group, an ambiguous/architectural task, or one likely to need `NEEDS_CONTEXT` round-trips. The script can't SendMessage mid-flight — use `subagents`.
- ❌ Committing or running tests/lint inside the Workflow script. The script implements + fixes only; the coordinator owns 3d–3g.
- ❌ Looping a Workflow more than once per wave to chase blocked tasks. One invocation; stragglers fall back to hand-orchestrated subagents.
- ❌ Spawning `bdk:code-reviewer` per task. End-of-branch only — it sees cross-task patterns the per-task view misses.
- ❌ Sequencing `bdk:architecture-reviewer` and the final `bdk:test-runner` in Step 4. They are independent read-only checks and **must** be dispatched in a single coordinator message with two `Agent` calls.
- ❌ Hardcoding test cadence ("every 3 tasks"). Pure orchestrator judgment per group, bounded by the 2-consecutive-skip cap.
- ❌ Asking the user for confirmation mid-flow. Autonomous skill — surface decisions only on terminal failure or user interrupt. Enforced, not merely asked for: the frontmatter's `disallowed-tools: AskUserQuestion` removes the tool from the pool for the run, so a mid-flow question is not available to reach for. Surface a terminal failure as a printed report and stop; do not look for another way to prompt.
- ❌ Letting an implementer read the plan file. Pass full task text in the dispatch prompt.
- ❌ Hardcoding `pytest`, `npm test`, etc. in any prompt to a subagent. Subagents detect from project context.
- ❌ Accepting prose returns from implementers. Malformed return → `BLOCKED` and re-dispatch.

---

## References

- `references/return-contract.md` — REQUIRED YAML envelope every implementer/fixer subagent must emit. Source of truth.
- `references/explorer-contract.md` — REQUIRED JSON envelope `bdk:explorer` returns for group planning. Source of truth.
- `references/model-selection.md` — when to pick haiku vs sonnet vs opus for the implementer.
- `references/dispatch-templates.md` — exact dispatch prompts for implementer, fixer, and verification subagents, plus the **Workflow wave dispatch** script skeleton + `RETURN_SCHEMA` for the `workflow` strategy. Cites the two contracts above. `bdk:explorer` has no template: dispatch it ad hoc and hold it to `explorer-contract.md`.
- `${CLAUDE_PLUGIN_ROOT}/skills/cr/references/review-engine.md` — the shared review process for Step 4a, owned by `/bdk:cr`. Read it at 4a, not at load: it is needed once, at the end of the run, and the coordinator is protecting a context budget. Reviewer dispatch prompts live beside it in `reviewer-prompt-template.md`.
