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
          command: "mkdir -p .bdk/plans .bdk/create-plan"
          once: true
---

# Create Implementation Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Transform requirements into detailed, TDD-driven implementation plans via structured exploration and analysis.

**Core Principle**: Explore → Analyze → Design → Plan → Document

**Announce at start:** "Using create-plan to build an implementation plan."

**Hard rules (apply to every phase):**
- Do NOT implement code. Plan is the only deliverable.
- Do NOT hardcode language tools (`pytest`, `npm`, `cargo`, etc.) — use injected values or fall back to "run the project's test suite".

---

## 6-Phase Workflow

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

   > Directories `.bdk/plans/` and `.bdk/create-plan/` are pre-created by the skill's `UserPromptSubmit` hook — no runtime mkdir needed.

5. **Existing-plan handling** — if file exists, `AskUserQuestion`:
   - Overwrite (keep same path)
   - Create v2 (append `-v2` per slug rule above)
   - Stop

6. **Check design docs** — scan `.bdk/brainstorming/` for slug keywords; if found, print `[create-plan] Found related design doc: {filename}` and read it.

Print: `[create-plan] Setup complete. Plan: <path>`

**GATE:** valid input + plan path required before Phase 2.

---

### Phase 2: Exploration

Graph-first architecture snapshot:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

Using the exploration tools above:
1. Identify affected layers.
2. Identify named execution flows the feature may touch.
3. Identify cross-module dependencies the plan must account for.

**Persist snapshot** to `.bdk/create-plan/<slug>-context.md` so it survives context compaction and is auditable from the resulting plan. Reference this file in every explorer-agent prompt.

**Scope tier** (drives fan-out):
- **Simple** — single function/class → 1 agent
- **Medium** — cross-file, multiple components → 2 agents
- **Complex** — architectural change, new subsystem → 3 agents

Print: `[create-plan] Launching {N} exploration agents (scope: {Simple|Medium|Complex})...`

**Explorer-agent output contract** — every explorer MUST return JSON with these keys (empty arrays allowed, never omitted):

```json
{
  "utilities": [{"name": "...", "path": "...", "why_relevant": "..."}],
  "affected_files": [{"path": "...", "reason": "..."}],
  "similar_features": [{"name": "...", "path": "...", "pattern": "..."}],
  "notes": "free-text caveats or gaps"
}
```

Aggregator merges arrays by `path`+`name` dedup.

| Agent | When | Source prompt |
|---|---|---|
| Agent 1 — Utilities & Existing Implementations | Always | `references/explorer-prompts.md` Agent 1 |
| Agent 2 — Architecture & Dependencies | Medium or Complex | `references/explorer-prompts.md` Agent 2 |
| Agent 3 — Similar Features | Complex only | `references/explorer-prompts.md` Agent 3 |

**Failure handling:** if an agent errors or returns malformed JSON, retry once with a narrowed prompt. On second failure, record `[create-plan] Agent {N}: no results` and proceed; note the gap in the plan's Risks section.

> Retry via `SendMessage(to: "<agentId>", ...)` with the narrowed prompt — the agent's exploration context is already loaded and re-using it is cheaper than a fresh spawn. See STARTUP "Continuing a Spawned Agent".

Wait for all agents, then print:
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

### Phase 4: Write Plan

Inject project tools context:

- Test tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`
- Lint tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

If either command fails (no `.bdk/settings.json`), fall back to generic phrasing ("run the project's test suite", "run the project's linter") and continue — do not stop.

For each `<!-- INJECT: <name> -->` marker in `references/plan-template.md`, run:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>
```

Substitute stdout in place of the marker. **On non-zero exit, surface stderr and stop** — quality rules are mandatory.

Write the plan to `<path>` using `references/plan-template.md`.

**Plan structure (top-level sections, in order):**
1. Summary & selected approach
2. Architectural context (link to `.bdk/create-plan/<slug>-context.md`)
3. Files to create / modify (exact paths)
4. Tasks (TDD cycles, see sizing rule below)
5. Verification (uses injected test/lint tools)
6. Risks & open questions (include any degraded-agent gaps from Phase 2)
7. Quality-rule sections injected from `<!-- INJECT: ... -->` markers

**Task-sizing rule** — one task =
- one test file added or edited, AND
- ≤ 1 production file changed, AND
- ≤ 40 LOC delta (excluding test scaffolding).

If a unit exceeds any threshold, split it.

**Each task must:**
- Specify exact file paths.
- Be a single TDD cycle (write test → fail → implement → pass).
- End with: `> Follow /bdk:test-driven-development skill for the red-green-clean cycle.`

Print: `[create-plan] Plan written: <path> — {N} tasks, {M} files to modify, {K} files to create`

**GATE:** plan file must exist and be readable.

---

### Phase 5: Plan Validation

- [ ] Re-read the written plan against the original request (`$ARGUMENTS`) and selected approach
- [ ] Check:
  - Solves the stated problem?
  - Edge cases and failure modes covered?
  - Every task has exact file paths and a single TDD cycle?
  - Task-sizing rule respected (≤1 prod file, ≤40 LOC delta)?
  - Risks & open questions listed (including degraded-agent gaps from Phase 2)?
  - Success criteria observable and testable?
  - No hardcoded language tools (`pytest`, `npm`, etc.)?
- [ ] List gaps found
- [ ] Address gaps by editing the plan in place — do not defer to Phase 5

Print: `[create-plan] Validation: {N} gaps found and addressed` (or `Validation: clean`)

**GATE:** No unresolved gaps before Phase 5.

---

### Phase 6: Summary & Handoff

```
[create-plan] Done.

  Plan:        <path>
  Approach:    {selected approach name}
  Complexity:  {LOW|MEDIUM|HIGH}
  Tasks:       {N}
  Files:       {M} to modify, {K} to create
  Context:     .bdk/create-plan/<slug>-context.md

  Next steps:
    1. Review the plan
    2. Edit if needed
    3. Execute with /bdk:execute-plan or manually
```

**Do NOT start implementing. Plan is the deliverable.**

---

## Key Principles

- Exact file paths always.
- Bite-sized TDD tasks per the sizing rule above.
- NEVER hardcode language tools — detect from project context.
- Explorer agents for discovery — always dispatch, never skip.
- Trade-off analysis mandatory — even if one approach is obvious.
- Persist exploration context to disk; do not rely on the orchestrator window surviving compaction.

## Anti-Patterns (MANDATORY)

- NEVER skip exploration.
- NEVER write vague steps — every step needs specific files and code.
- NEVER skip trade-off analysis.
- NEVER implement code — explore, analyze, document only.
- NEVER hardcode `pytest`, `uv run`, `bin/cleanup.sh`, or any project-specific commands.
- NEVER ask more than 3 `AskUserQuestion` calls in one run.
- NEVER invent timestamps — always shell out to `date`.
