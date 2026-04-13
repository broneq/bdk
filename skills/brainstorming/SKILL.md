---
name: brainstorming
description: "You MUST use this before any creative work - creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation."
argument-hint: [feature description]
model: opus
effort: max
user-invocable: true
context: main
---

# Brainstorming Ideas Into Designs

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Transform vague ideas into concrete, validated designs through structured dialogue.

**Core Principle**: Understand → Explore → Design → Validate → Document

---

## The 7-Phase Workflow

### Phase 1: Context Analysis
- [ ] Read project `CLAUDE.md` and relevant rules
- [ ] Check recent commits (last 5)
- [ ] Decide subagent count based on complexity
- [ ] Use subagents to explore related code
- [ ] Note constraints (tech stack, patterns, conventions)

**GATE**: Complete context analysis before Phase 2.

---

### Phase 2: Requirement Discovery
- [ ] Ask ONE question at a time (never multiple)
- [ ] Use `AskUserQuestion` with 2-4 options when possible
- [ ] Clarify: problem, users, success criteria, constraints
- [ ] WAIT for answer before proceeding

**GATE**: Clear success criteria before Phase 3.

---

### Phase 3: Approach Exploration
- [ ] Present 2-3 alternative approaches
- [ ] For each: description, pros, cons, complexity
- [ ] Lead with recommended option + reasoning

**GATE**: User selects approach before Phase 4.

---

### Phase 4: Design Presentation
- [ ] Break design into 200-300 word sections:
  - Architecture overview
  - Key components
  - Data flow
  - Error handling
  - Testing approach
- [ ] Present ONE section at a time
- [ ] After EACH section: "Does this look right so far?"
- [ ] WAIT for validation before next section

**GATE**: All sections user-approved before Phase 5.

---

### Phase 5: Design Validation
- [ ] Review design against original request
- [ ] Check: solves problem? edge cases? error handling? testing clear?
- [ ] List gaps found
- [ ] Address gaps before proceeding

**GATE**: No unresolved gaps before Phase 6.

---

### Phase 6: Documentation
- [ ] Create file: `.bdk/brainstorming/YYYY-MM-DD-<topic>-design.md`
- [ ] Include: Problem, Solution, Architecture, Components, Data Flow, Error Handling, Testing
- [ ] Verify file created

See [design-template](references/design-template.md) for full document structure.

```markdown
# [Feature Name] Design

**Date**: YYYY-MM-DD
**Status**: Draft | Approved | Implemented

> **Implementation Note**: To implement this design, use `/bdk:create-plan` to generate a detailed implementation plan.

## Problem Statement
[2-3 sentences]

## Selected Solution

### Architecture Overview
[high-level description]

### Key Components
[list of components with responsibilities]

### Data Flow
[step-by-step flow]

### Error Handling
[error scenarios and responses]

## Testing Strategy
[unit, integration, edge cases]
```

**GATE**: Design document exists, matches approved content.

---

### Phase 7: Implementation Handoff
- [ ] Ask user: "Ready to set up for implementation?"
- [ ] If YES → Use `/bdk:create-plan`
- [ ] If NO → Clarify what's missing

---

## Key Principles

- **One question at a time** — No overwhelm
- **Multiple choice preferred** — Easier to answer
- **YAGNI ruthlessly** — Simplest solution wins
- **Explore alternatives** — Always 2-3 approaches first
- **Incremental validation** — Present in sections, validate each
- **No premature implementation** — Complete design first

## Anti-Patterns

- ❌ Jumping to implementation before design approval
- ❌ Presenting entire design at once
- ❌ Assuming requirements (ask instead)
- ❌ Over-engineering (YAGNI)
- ❌ Asking multiple questions at once