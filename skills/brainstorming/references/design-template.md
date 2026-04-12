# Design Document Template

Use this template when writing to `.bdk/brainstorming/YYYY-MM-DD-<topic>-design.md`.

---

```markdown
# [Feature Name] Design

**Date**: YYYY-MM-DD
**Status**: Draft | Approved | Implemented
**Author**: [Your name or "Claude + User"]

> **⚠️ Implementation Note**: This is a design document only. To implement this design, use `/bdk:create-plan` to generate a detailed implementation plan with step-by-step tasks.

---

## Problem Statement

[2-3 sentences describing the problem this design solves]

**User Need**: [What users need]
**Current Pain Point**: [What's broken or missing]
**Success Criteria**: [How we know this is working]

---

## Considered Approaches

### Option 1: [Name] ⭐ (Selected)

**Description**: [1-2 sentences]
**Pros**: [What it does well]
**Cons**: [What it sacrifices]
**Complexity**: Simple | Moderate | Complex

---

### Option 2: [Name] (Not Selected)

**Description**: [1-2 sentences]
**Why Not Selected**: [Reasoning]

---

## Selected Solution

### Architecture Overview

[Describe the high-level architecture]

**Data Flow**:
```
[Step 1] → [Step 2] → [Step 3]
```

---

### Key Components

#### [Component 1 Name]

**Responsibility**: [What it does]
**Key Methods**: `method1()`, `method2()`
**Dependencies**: [What it needs]

---

### Error Handling

**[Error Type]**: [When it happens] → [Response] → [User sees what]

---

### Edge Cases

- **[Edge Case 1]**: [How we handle it]

---

## Testing Strategy

**Unit Tests**: Test [components] for [behaviors]
**Integration Tests**: Test [full flows]
**Coverage Target**: [X]%

---

## Open Questions

- [ ] [Question 1]
```
