---
name: create-plan
description: Create comprehensive implementation plan with exploration and trade-off analysis
argument-hint: [feature description or design doc path]
model: opus
effort: high
user-invocable: true
context: main
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

# Create Implementation Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Transform requirements into detailed, TDD-driven implementation plans via structured exploration and analysis.

**Core Principle**: Explore → Analyze → Design → Plan → Document

**Announce at start:** "Using create-plan to build an implementation plan."

---

## 5-Phase Workflow

### Phase 1: Parse & Setup

1. **Validate input**:
   - `$ARGUMENTS` empty/blank: ask user to describe feature, **stop**
   - Input vague (< 10 words OR generic like "make it better"): suggest `/bdk:brainstorming`, **stop**

2. **Extract topic slug**: 3-5 descriptive words, kebab-case, lowercase

3. **Set plan path**: `.bdk/plans/YYYY-MM-DD-HHMM-<slug>.md`

4. **Create directory**: ensure `.bdk/plans/` exists

5. **Check existing plan**: if file exists, `AskUserQuestion`: Overwrite / Create v2 / Stop

6. **Check design docs**: scan `.bdk/brainstorming/` for slug keywords; if found, print `[create-plan] Found related design doc: {filename}` and read it

Print: `[create-plan] Setup complete. Plan: .bdk/plans/YYYY-MM-DD-HHMM-{slug}.md`

**GATE**: valid input + plan path required before Phase 2.

---

### Phase 2: Exploration

Before launching agents, run a graph-first architecture snapshot:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

Using the exploration tools above:
1. Understand which layers are affected
2. Identify named execution flows the feature may touch
3. Detect cross-module dependencies the plan must account for

Pass these findings to each explorer agent as architectural context.

Launch explorer agents IN PARALLEL.

**Scope:**
- **Simple** (single function/class): 1 agent
- **Medium** (cross-file, multiple components): 2 agents
- **Complex** (architectural change, new subsystem): 3 agents

Print: `[create-plan] Launching {N} exploration agents...`

**Agent 1: Utilities & Existing Implementations** (ALWAYS launch)

Use subagent_type `explorer` with prompt from `references/explorer-prompts.md` Agent 1.

**Agent 2: Architecture & Dependencies** (Medium or Complex)

Use subagent_type `explorer` with prompt from `references/explorer-prompts.md` Agent 2.

**Agent 3: Similar Features** (Complex only)

Use subagent_type `explorer` with prompt from `references/explorer-prompts.md` Agent 3.

Wait for all agents, then print:
```
[create-plan] Exploration complete:
  - Utilities: {N found}
  - Affected files: {N found}
  - Similar features: {N found}
```

**GATE**: exploration results required before Phase 3.

---

### Phase 3: Design & Decisions

Generate 2-3 implementation approaches.

**Per approach:**
- Name, Description (2-3 sentences)
- Design pattern, OO principles
- Pros (2-3), Cons (1-2)
- Complexity: LOW | MEDIUM | HIGH
- Risk: LOW | MEDIUM | HIGH
- Files to change

**Resolve open decisions** via `AskUserQuestion`:
- Approach selection (mark recommended)
- Ambiguous requirements

Print: `[create-plan] Design complete: {selected approach name}`

**GATE**: selected approach required before Phase 4.

---

### Phase 4: Write Plan

Inject project tools context before writing:

- Test tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`
- Lint tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`
For each `<!-- INJECT: <name> -->` marker in `references/plan-template.md`, run:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>
```

Substitute the script's stdout in place of the marker in the final plan output. If exit is non-zero, surface the stderr message and stop — quality rules are mandatory context for every plan.

Use these values when filling the Verification section of `references/plan-template.md`. If a command fails (no `.bdk/settings.json`), fall back to generic phrasing ("run the project's test suite").

Write to `.bdk/plans/YYYY-MM-DD-HHMM-{slug}.md`. Use template in `references/plan-template.md`.

**Critical requirements:**
- Each task = one TDD cycle (write test → fail → implement → pass)
- Each task: 2-5 min
- Exact file paths always
- Every task ends with: `> Follow /bdk:test-driven-development skill for the red-green-clean cycle.`
- NEVER hardcode test runner/build tool — use injected values above, or fall back to "run the project's test suite"

Print: `[create-plan] Plan written: .bdk/plans/YYYY-MM-DD-HHMM-{slug}.md — {N} tasks, {N} files to modify, {N} files to create`

**GATE**: plan file must exist and be readable.

---

### Phase 5: Summary & Handoff

```
[create-plan] Done.

  Plan:        .bdk/plans/YYYY-MM-DD-HHMM-{slug}.md
  Approach:    {selected approach name}
  Complexity:  {LOW|MEDIUM|HIGH}
  Tasks:       {N} implementation tasks
  Files:       {N} to modify, {N} to create

  Next steps:
    1. Review the plan
    2. Edit if needed
    3. Execute with /bdk:execute-plan or manually
```

**Do NOT start implementing. Plan is the deliverable.**

---

## Key Principles

- Exact file paths always
- Bite-sized TDD tasks (2-5 min each)
- NEVER hardcode language tools — detect from project context
- Explorer agents for discovery — always dispatch, never skip
- Trade-off analysis mandatory — even if one approach obvious

## Anti-Patterns (MANDATORY)

- NEVER skip exploration
- NEVER write vague steps — every step needs specific files and code
- NEVER skip trade-off analysis
- NEVER implement code — explore, analyze, document only
- NEVER hardcode `pytest`, `uv run`, `bin/cleanup.sh`, or any project-specific commands
