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

**Announce at start:** "Using create-plan to build an implementation plan."

**Hard rules:**
- Do NOT implement code — plan is the only deliverable.
- Do NOT hardcode language tools (`pytest`, `npm`, `cargo`) — use injected values or fall back to "run the project's test suite".

---

## Workflow

### Phase 1: Parse & Setup

1. **Validate input**
   - `$ARGUMENTS` empty/blank → ask user to describe feature, **stop**.
   - Vague (< 10 words OR generic like "make it better") → suggest `/bdk:brainstorming`, **stop**.

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

6. **Check design docs** — scan `.bdk/brainstorming/` for slug keywords; if found, print `[create-plan] Found related design doc: {filename}` and read it.

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

**Decision resolution** — bundle every open decision into ONE `AskUserQuestion` call (multi-question form supports up to 4). Mark recommended approach as first option. Do not split into multiple sequential prompts.

Print: `[create-plan] Design complete: {selected approach name}`

**GATE:** selected approach required before Phase 4.

---

### Phase 4: Outline + Verify (in memory)

Build the plan **as a structured outline in conversation**, not on disk yet. Validation runs against the outline — cheap, already in context. No re-read of a written file.

**Outline structure** (mirror Phase 5 final layout):
1. Summary & selected approach
2. Context (architectural snapshot from Phase 2 — inline, no external file)
3. Files to create / modify (exact paths)
4. Tasks — each a single TDD cycle
5. Verification
6. Risks & open questions (include degraded-agent gaps from Phase 2)

**Task-sizing rule** — one task =
- one test file added or edited, AND
- ≤ 1 production file changed, AND
- ≤ 40 LOC delta (excluding test scaffolding).

Split anything that exceeds these thresholds.

**Verify the outline** — answer each:
- [ ] Solves the stated problem in `$ARGUMENTS`?
- [ ] Edge cases and failure modes covered?
- [ ] Every task has exact file paths and a single TDD cycle?
- [ ] Task-sizing rule respected?
- [ ] Risks & open questions listed (including Phase 2 gaps)?
- [ ] Success criteria observable and testable?
- [ ] No hardcoded language tools (`pytest`, `npm`, etc.)?

Fix gaps in the outline before moving to Phase 5. Do not write to disk with known gaps.

Print: `[create-plan] Outline verified: {N} gaps found and fixed` (or `Outline verified: clean`)

**GATE:** verified outline required before Phase 5.

---

### Phase 5: Write Plan (single pass)

Inject project tools context:

- Test tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`
- Lint tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

If either command fails (no `.bdk/settings.json`), fall back to generic phrasing ("run the project's test suite", "run the project's linter") and continue — do not stop.

For each `<!-- INJECT: <name> -->` marker in `references/plan-template.md`, run:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>
```

Substitute stdout in place of the marker. **On non-zero exit, surface stderr and stop** — quality rules are mandatory.

Render the verified outline to `<path>` using `references/plan-template.md`. Each task ends with: `> Follow /bdk:test-driven-development skill for the red-green-clean cycle.`

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

  Next steps:
    1. Review the plan
    2. Edit if needed
    3. Execute with /bdk:execute-plan or manually
```

**Do NOT start implementing. Plan is the deliverable.**

---

## Rules (apply throughout)

- Exact file paths always; no vague steps.
- Bite-sized TDD tasks per the Phase 4 sizing rule.
- Always dispatch explorer subagents — never explore from the orchestrator.
- Trade-off analysis mandatory, even when one approach seems obvious.
- Never hardcode language tools (`pytest`, `npm`, `cargo`, `uv run`, …) — use injected values or generic phrasing.
- Never invent timestamps — shell out to `date`.
- Cap `AskUserQuestion` calls at 3 per run.
