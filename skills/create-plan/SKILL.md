---
name: create-plan
description: Create comprehensive implementation plan with exploration and trade-off analysis
argument-hint: [feature description or design doc path]
model: opus
user-invocable: true
context: main
---

# Create Implementation Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Transform requirements into detailed, TDD-driven implementation plans through structured exploration and analysis.

**Core Principle**: Explore → Analyze → Design → Plan → Document

**Announce at start:** "Using create-plan to build an implementation plan."

---

## The 5-Phase Workflow

### Phase 1: Parse & Setup

1. **Validate input**:
   - If `$ARGUMENTS` is empty/blank: Ask user to describe the feature and **stop**
   - If input is vague (< 10 words OR generic terms like "make it better"): Suggest `/bdk:brainstorming-session` first and **stop**

2. **Extract topic slug**: Take 3-5 most descriptive words, convert to kebab-case, lowercase

3. **Set plan file path**: `docs/plans/YYYY-MM-DD-<slug>.md`

4. **Create directory**: Ensure `docs/plans/` exists

5. **Check for existing plan file**:
   - If file already exists: use `AskUserQuestion` with options: Overwrite, Create v2, Stop

6. **Check for related design docs**:
   - Look for markdown files in `docs/designs/` with keywords from topic slug
   - If found: print `[create-plan] Found related design doc: {filename}` and read it

Print: `[create-plan] Setup complete. Plan: docs/plans/YYYY-MM-DD-{slug}.md`

**GATE**: Must have valid input and plan path before Phase 2.

---

### Phase 2: Exploration

Launch explorer agents IN PARALLEL to gather architectural context.

**Scope determination:**
- **Simple** (single function/class, localized change): 1 agent
- **Medium** (cross-file, multiple components): 2 agents
- **Complex** (architectural change, new subsystem): 3 agents

Print: `[create-plan] Launching {N} exploration agents...`

**Agent 1: Utilities & Existing Implementations** (ALWAYS launch)

Use subagent_type `explorer` with prompt:
```
Search the codebase for existing utilities and implementations related to:

Feature: {feature description}

1. Check if similar functionality already exists
2. Find helper functions or base classes that could be reused
3. Identify relevant models or data structures
4. Search for patterns or conventions this feature should follow

Return structured findings:
EXISTING_IMPLEMENTATIONS: {list file:symbol paths or NONE}
REUSABLE_UTILITIES: {list file:symbol paths or NONE}
RELEVANT_MODELS: {list file paths or NONE}
PATTERNS_FOUND: {describe 1-2 patterns this feature should follow}
```

**Agent 2: Architecture & Dependencies** (Medium or Complex scope)

Use subagent_type `explorer` with prompt:
```
Analyze architecture and dependencies for implementing:

Feature: {feature description}

1. Identify which modules/layers this feature touches
2. Find which existing components need changes
3. Trace dependencies
4. Check for related test files and test patterns

Return structured findings:
AFFECTED_LAYERS: {list layers}
AFFECTED_FILES: {list file paths}
DEPENDENCIES: {what this feature depends on}
TEST_PATTERNS: {describe testing approach from existing tests}
ARCHITECTURAL_CONSTRAINTS: {patterns to follow}
```

**Agent 3: Similar Features** (Complex scope only)

Use subagent_type `explorer` with prompt:
```
Find similar features in the codebase as implementation examples:

Feature: {feature description}

1. Search for features with similar purpose or structure
2. Find examples of similar data transformations or validations
3. Identify common error handling patterns
4. Look for similar integration tests

Return structured findings:
SIMILAR_FEATURES: {list file:symbol paths}
IMPLEMENTATION_EXAMPLES: {1-2 examples with brief description}
ERROR_HANDLING_PATTERNS: {how errors are handled in similar code}
TEST_EXAMPLES: {test file paths for similar features}
```

**Wait for all agents**, then print:
```
[create-plan] Exploration complete:
  - Utilities: {N found}
  - Affected files: {N found}
  - Similar features: {N found}
```

**GATE**: Must have exploration results before Phase 3.

---

### Phase 3: Design & Decisions

Generate 2-3 implementation approaches.

**For each approach determine:**
- **Name**, **Description** (2-3 sentences)
- **Design pattern**, **OO principles**
- **Pros** (2-3 benefits), **Cons** (1-2 drawbacks)
- **Complexity:** LOW | MEDIUM | HIGH
- **Risk:** LOW | MEDIUM | HIGH
- **Files to change** (list file paths)

**Resolve open decisions** using `AskUserQuestion`:
- Approach selection (present approaches as options, mark recommended)
- Ambiguous requirements

Print: `[create-plan] Design complete: {selected approach name}`

**GATE**: Must have selected approach before Phase 4.

---

### Phase 4: Write Plan

Write the complete plan to `docs/plans/YYYY-MM-DD-{slug}.md`.

**Plan structure:**
```markdown
# Plan: [Feature Title]

**Created:** YYYY-MM-DD
**Status:** Ready for implementation
**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Complexity:** LOW | MEDIUM | HIGH

---

## Context
[2-3 paragraphs: what, why, how it fits]

---

## Explored Approaches

### Approach 1: [Name] (Selected)
**Description:** ...
**Pros:** ...
**Cons:** ...
**Files to change:** ...

### Approach 2: [Name] (Not Selected)
**Why not selected:** ...

---

## Implementation Tasks

### Task N: [Action verb + what]

**Files:**
- Modify/Create: `exact/path/to/file`
- Test: `tests/exact/path/test_file`

**Test cases:**
- ✅ Positive: given [input], expects [output]
- ❌ Negative: given [invalid input], raises [error]

**Test scaffold:**
[One test stub per test case with arrange/act/assert skeleton]

**Implementation:** [class, method, key logic]

> Follow `/bdk:test-driven-development` skill for the red-green-clean cycle.

---

## Verification

### Tests
Delegate to `test-runner` subagent:
  Run the project's test suite against the relevant paths

### Code Quality
Delegate to `static-analyse` subagent:
  Run the project's lint/format/type-check commands

---

## Success Criteria
- All tests pass
- Static analysis passes
- [Feature-specific criteria]
```

**Critical requirements:**
- Each task is one TDD cycle (write test → verify fails → implement → verify passes)
- Each task takes 2-5 minutes
- Exact file paths always
- Every task ends with: `> Follow /bdk:test-driven-development skill for the red-green-clean cycle.`
- NEVER hardcode test runner or build tool — write "run the project's test suite"

Print: `[create-plan] Plan written: {N} tasks, {N} files to modify, {N} files to create`

**GATE**: Plan file must exist and be readable.

---

### Phase 5: Summary & Handoff

```
[create-plan] Done.

  Plan:        docs/plans/YYYY-MM-DD-{slug}.md
  Approach:    {selected approach name}
  Complexity:  {LOW|MEDIUM|HIGH}
  Tasks:       {N} implementation tasks
  Files:       {N} to modify, {N} to create

  Next steps:
    1. Review the plan
    2. Edit if needed
    3. Execute with /bdk:execute-plan or manually
```

**Do NOT start implementing. The plan is the deliverable.**

---

## Key Principles

- **Exact file paths always**
- **Bite-sized TDD tasks** (2-5 min each)
- **NEVER hardcode language tools** — detect from project context
- **Explorer agents for discovery** — always dispatch, never skip
- **Trade-off analysis mandatory** — even if one approach is obvious

## Anti-Patterns (MANDATORY)

- NEVER skip exploration
- NEVER write vague steps — every step must have specific files and code
- NEVER skip trade-off analysis
- NEVER implement code — explore, analyze, and document only
- NEVER hardcode `pytest`, `uv run`, `bin/cleanup.sh`, or any project-specific commands
