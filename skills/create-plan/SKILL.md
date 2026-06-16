---
name: create-plan
description: Create comprehensive implementation plan with exploration and trade-off analysis
argument-hint: [feature description or design doc path]
model: opus
effort: high
user-invocable: true
disable-model-invocation: true
context: main
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*) Bash(date *)
hooks:
  UserPromptSubmit:
    - hooks:
        - type: command
          command: "mkdir -p .bdk/plans"
          once: true
---

# Create Implementation Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Transform requirements into detailed, TDD-driven implementation plans via structured exploration and analysis.

**Core Principle:** Explore → Design → Outline+Verify → Write

**Optimize for parallel execution.** The plan is consumed by `/bdk:subagent-execute-plan`, which fans out as many implementer subagents as it can run concurrently. The single biggest lever on end-to-end speed is **how the plan decomposes work**: tasks that touch disjoint files and declare honest dependencies let the executor run a wide wave instead of a long serial chain. A plan that is correct but accidentally serial is a slow plan. Design the task graph to be **wide and shallow**, not deep.

**Announce at start:** "Using create-plan to build an implementation plan."

**Hard rules:**
- Do NOT implement code — plan is the only deliverable.
- Do NOT hardcode language tools (`pytest`, `npm`, `cargo`) — use injected values or fall back to "run the project's test suite".
- Every task MUST declare its `Files:` and its `Depends on:` (or `Depends on: none`). The executor uses both to compute parallel waves — omitting them forces conservative serial fallback.

---

## Workflow

### Phase 1: Parse & Setup

1. **Validate input**
   - `$ARGUMENTS` empty/blank → ask user to describe feature, **stop**.
   - Vague (< 10 words OR generic like "make it better") → suggest `/bdk:design`, **stop**.

2. **Derive slug deterministically**
   - Lowercase `$ARGUMENTS`, strip punctuation, drop stop-words `{the, a, an, for, to, of, in, on, with, and, or}`.
   - Keep first 3-5 remaining content words, join with `-`.
   - On collision in `.bdk/plans/`, append `-v2`, `-v3`, … (lowest free integer).

3. **Generate timestamp deterministically**
   - Use !`date +%Y-%m-%d-%H%M` — do not invent.

4. **Set plan path:** `.bdk/plans/<timestamp>-<slug>.md`

   > Directory `.bdk/plans/` is pre-created by the skill's `UserPromptSubmit` hook — no runtime mkdir needed.

5. **Existing-plan handling** — if file exists, `AskUserQuestion`:
   - Overwrite (keep same path)
   - Create v2 (append `-v2` per slug rule above)
   - Stop

6. **Check design docs** — scan `.bdk/design/` for slug keywords; if found, print `[create-plan] Found related design doc: {filename}` and read it.

Print: `[create-plan] Setup complete. Plan: <path>`

**GATE:** valid input + plan path required before Phase 2.

---

### Phase 2: Exploration (always via subagents)

Exploration runs in subagents — never in the orchestrator. Subagent context is throwaway, orchestrator context is precious. A "small" feature can still need many tool calls; agent count tracks **question dimensions**, not feature size.

**Pick agents by question** (see `references/explorer-prompts.md` for full prompts and shared output contract):

| Agent | Question it answers | Always launch? |
|---|---|---|
| Agent 1 — Existing Code | What can be reused? | **Yes, always** |
| Agent 2 — Architecture & Dependencies | What does it touch, what depends on it? | If feature modifies existing components or crosses module boundaries |
| Agent 3 — Similar Features | How have comparable features been built before? | If a similar pattern likely exists in the codebase |

These dimensions are orthogonal — choosing one doesn't imply the others.

Print: `[create-plan] Launching {N} explorer(s): {list of agent names}`

**Failure handling:** on agent error or malformed JSON, retry once via `SendMessage(to: "<agentId>", ...)` with a narrowed prompt — cheaper than a fresh spawn (see STARTUP "Continuing a Spawned Agent"). On second failure, record `[create-plan] Agent {N}: no results` and proceed; note the gap in the plan's Risks section.

**Aggregation:** merge agent JSON outputs by `path`+`name` dedup. Keep the merged result in conversation context — do **not** persist a snapshot file. The plan's Context section will capture what's needed.

Print:
```
[create-plan] Exploration complete:
  - Utilities: {N}
  - Affected files: {N}
  - Similar features: {N}
  - Degraded agents: {list or "none"}
```

**GATE:** at least Agent 1 must succeed before Phase 3.

---

### Phase 3: Design & Decisions

Before generating approaches, write a **3-line Hypothesis**:
1. Problem essence (one sentence).
2. Primary constraint (perf / compat / scope / risk).
3. Success criterion (observable, testable).

Generate **2-3 implementation approaches.** Per approach:
- Name, Description (2-3 sentences)
- Design pattern, OO principles
- Pros (2-3), Cons (1-2)
- Complexity: LOW | MEDIUM | HIGH
- Risk: LOW | MEDIUM | HIGH
- Files to change
- **Structural impact** — if this approach extends an existing conditional / switch / handler chain (if-elif, switch, type-dispatch, registry):
  - Branches before: `N`
  - Branches after: `N+1`
  - At what `N` does this structure stop being the right shape? Name the refactor (Strategy map, polymorphism, dispatch table, state machine, etc.).
  - If `N+1` crosses that threshold, **propose the refactor as a separate approach** — do not silently add another branch.

**Parallelism is a first-class design axis.** When comparing approaches, prefer the one that decomposes into more independent units of work — all else roughly equal, an approach that yields 6 file-disjoint tasks beats one that yields 3 tasks chained by shared-file edits. Note each approach's **parallel width** (how many tasks could run at once) alongside its complexity/risk. A lower-complexity approach that is fully serial may lose to a slightly more complex approach that fans out.

**Decision resolution** — bundle every open decision into ONE `AskUserQuestion` call (multi-question form supports up to 4). Mark recommended approach as first option. Do not split into multiple sequential prompts.

**Decision gates rejected inside tasks.** A task body must describe a single committed action. If a task would contain "Option A or B — user picks" or any unresolved decision, split it: move the decision into the bundled `AskUserQuestion` call above, then write the chosen action as the task. Tasks describe what *will* happen, not what *might* happen.

Print: `[create-plan] Design complete: {selected approach name}`

**GATE:** selected approach required before Phase 4.

---

### Phase 4: Outline + Verify (in memory)

Build the plan **as a structured outline in conversation**, not on disk yet. Validation runs against the outline — cheap, already in context. No re-read of a written file.

**Outline structure** (mirror Phase 5 final layout):
1. Summary & selected approach
2. Context (architectural snapshot from Phase 2 — inline, no external file)
3. Files to create / modify (exact paths)
4. Tasks — each a single TDD cycle, each with `Files:` and `Depends on:`
5. Execution waves (derived from the task DAG — see below)
6. Verification
7. Risks & open questions (include degraded-agent gaps from Phase 2)

**Task-sizing rule** — one task =
- one test file added or edited, AND
- ≤ 1 production file changed, AND
- ≤ 40 LOC delta (excluding test scaffolding).

Split anything that exceeds these thresholds.

**Decompose for parallel width.** After sizing, deliberately shape the task graph so the executor can fan out:

- **Disjoint files = parallel.** Two tasks that touch no common file and have no data dependency can run in the same wave. Actively split work along file boundaries so independent units exist. If two tasks both edit one shared file (e.g. a central registry), see if one task can *create* a new file the other consumes instead — converting a shared-file collision into a producer→consumer dependency that still parallelizes across other tasks.
- **Declare honest dependencies, nothing more.** `Depends on:` lists only tasks that produce a symbol, file, or contract this task consumes. Do NOT add dependencies for ordering preference, "feels safer", or narrative flow — every spurious edge serializes work the executor could have parallelized. When unsure whether a dependency is real, ask: "would this task's tests fail to even compile/import without the other task's output?" If no, it is independent.
- **Wide and shallow beats deep.** Prefer a DAG with many roots (tasks depending on nothing) and few levels. A long `T1→T2→T3→T4→T5` chain is the worst case — the executor runs it fully serially. Look for chains and break them: can T3 and T4 both depend only on T2 instead of T4 depending on T3?
- **Shared-foundation first.** If many tasks need one new type/interface/module, make that its own root task (wave 1, depends on nothing). Everything that consumes it forms a wide wave 2.

**Compute execution waves.** From the `Depends on:` edges, group tasks into ordered waves: wave 1 = all tasks with `Depends on: none`; wave N = all tasks whose dependencies are all satisfied by waves < N and whose files are disjoint from other wave-N tasks. Two tasks in the same wave that share a file must be split across waves (or merged) — flag and fix. Record the waves explicitly; this is what the executor consumes to fan out without re-deriving the graph.

**Verify the outline** — answer each:
- [ ] Solves the stated problem in `$ARGUMENTS`?
- [ ] Edge cases and failure modes covered?
- [ ] Every task has exact file paths and a single TDD cycle?
- [ ] Task-sizing rule respected?
- [ ] Risks & open questions listed (including Phase 2 gaps)?
- [ ] Success criteria observable and testable?
- [ ] No hardcoded language tools (`pytest`, `npm`, etc.)?
- [ ] No task body contains an unresolved decision gate ("Option A or B — user picks")?
- [ ] Every task declares both `Files:` and `Depends on:` (`none` if independent) — no omissions?
- [ ] `Depends on:` lists only *real* producer→consumer edges (would the task fail to compile/import without the dependency)? No ordering-preference or "feels safer" edges?
- [ ] No two tasks in the same wave touch a shared file?
- [ ] Task graph is wide, not a single serial chain? (If every task depends on the previous one, re-decompose — flag in Risks if genuinely unavoidable.)
- [ ] Execution waves computed and recorded, consistent with the `Depends on:` edges?
- [ ] Doc-only tasks (Files: lists only `.md` / templates) use grep-able / file-presence assertions, not "re-read and confirm"?
- [ ] Every task's `**Implementation:**` is a fenced code block (diff for edits, language-tagged for new code), not prose paragraphs?
- [ ] Any rationale inside a task is a single `**Why:**` line above the code block — no multi-sentence reasoning embedded in the implementation?
- [ ] Architectural / cross-component reasoning lives in the approach's Rationale section, not inside individual tasks?

Fix gaps in the outline before moving to Phase 5. Do not write to disk with known gaps.

Print: `[create-plan] Outline verified: {N} gaps found and fixed` (or `Outline verified: clean`)
Print: `[create-plan] Parallelism: {T} tasks in {W} waves (max width {widest wave size}, critical path {longest dependency chain})`

**GATE:** verified outline required before Phase 5.

---

### Phase 5: Write Plan (single pass)

Project tools context:

- Test tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`
- Lint tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

If either command fails (no `.bdk/settings.json`), fall back to generic phrasing ("run the project's test suite", "run the project's linter") and continue — do not stop.

Rule sections loaded for plan rendering — copy verbatim into the plan's References section in place of the matching markers:

**`<!-- INJECT: code-quality -->` →**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py code-quality`

**`<!-- INJECT: architecture -->` →**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py architecture`

**`<!-- INJECT: design-patterns -->` →**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py design-patterns`

**`<!-- INJECT: security -->` →**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py security`

**`<!-- INJECT-LANGUAGES -->` →**

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-language-rules.py`

Render the verified outline to `<path>` using `references/plan-template.md`. For each `<!-- INJECT: <name> -->` and `<!-- INJECT-LANGUAGES -->` marker in the template, substitute verbatim with the matching section loaded above — do not summarize, paraphrase, or omit bullets. If a loaded section is empty (no languages configured, no override), drop the marker silently. Each task ends with: `> Follow /bdk:test-driven-development skill for the red-green-clean cycle.`

Print: `[create-plan] Plan written: <path> — {N} tasks, {M} files to modify, {K} files to create`

**GATE:** plan file must exist and be readable.

---

### Phase 6: Summary & Handoff

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
    3. Execute with /bdk:subagent-execute-plan (parallel fan-out) or /bdk:execute-plan (serial)
```

**Do NOT start implementing. Plan is the deliverable.**

---

## Rules (apply throughout)

- Exact file paths always; no vague steps.
- Bite-sized TDD tasks per the Phase 4 sizing rule.
- **Design for parallel execution**: maximize file-disjoint tasks, declare only real dependencies, prefer a wide-shallow DAG over a serial chain. The executor's speed is bounded by the critical path, not the task count.
- Every task carries `Files:` and `Depends on:` — mandatory, never omitted.
- Always dispatch explorer subagents — never explore from the orchestrator.
- Trade-off analysis mandatory, even when one approach seems obvious.
- Never hardcode language tools (`pytest`, `npm`, `cargo`, `uv run`, …) — use injected values or generic phrasing.
- Never invent timestamps — shell out to `date`.
