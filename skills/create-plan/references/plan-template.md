# Plan Template

Use this template when writing to `docs/plans/YYYY-MM-DD-<slug>.md`.

---

```markdown
# Plan: [Feature Title - descriptive]

**Created:** YYYY-MM-DD
**Status:** Ready for implementation
**Goal:** [One sentence describing what this builds]
**Architecture:** [2-3 sentences about approach]
**Complexity:** LOW | MEDIUM | HIGH

---

## Context

[2-3 paragraphs explaining:
- What this feature does and why it's needed
- How it fits into the existing architecture
- Related design docs (if found in docs/designs/)
- Key constraints or requirements]

---

## Explored Approaches

### Approach 1: [Name] (Selected)

**Description:** [2-3 sentences]

**Pros:**
- [benefit 1]
- [benefit 2]

**Cons:**
- [drawback 1]
- [drawback 2]

**Complexity:** LOW | MEDIUM | HIGH
**Risk:** LOW | MEDIUM | HIGH
**Files to change:** [bulleted list of file paths]

---

### Approach 2: [Name] (Not Selected)

**Description:** [2-3 sentences]

**Pros / Cons:** [brief]

**Why not selected:** [reasoning]

---

## Selected Approach: [Name]

**Rationale:** [Why this approach is best, referencing pros/cons]

---

## Implementation Tasks

### Task 1: [Action verb + what]

**Files:**
- Create: `exact/path/to/new_file.py`
- Modify: `exact/path/to/existing.py`
- Test: `tests/exact/path/test_file.py`

**Test cases:**
- ✅ Positive: given [input], expects [output]
- ✅ Positive: given [edge case input], expects [edge case output]
- ❌ Negative: given [invalid input], raises [error] *(omit if no meaningful failure mode exists)*

**Test scaffold:**
```python
# Setup: [which fixture/container is needed, e.g. "no fixture", "container fixture", "MockContainer with repo stub"]

# One stub per test case above:
def test_[name_matching_first_case]():
    # arrange
    [concrete input setup]
    # act + assert
    [call + assertion]

def test_[name_matching_second_case]():
    [...]

# CLI regression tasks: replace all stubs with:
# # CLI regression — see Verification section
```

**Implementation:** [class name, method signature, key logic]

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: [Next component]

[Same structure as Task 1]

---

[Continue for all tasks - each task should take 2-5 minutes]

---

## Reusable Components

**Existing utilities to leverage:**
- `file:symbol_path` - [what it does]

**Relevant schemas/models:**
- `file_path` - [what it defines]

**Patterns to follow:**
- [pattern from existing codebase]

**Test helpers to use:**
- `file:function_path` - [what it does]

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest [specific test paths for this feature] -v --cov=[specific source paths]
Coverage targets:
  - Critical paths: >90%
  - Business logic: >85%
```

### Code Quality

Delegate to `static-analyse` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Regression

*(Include this section only if the input provided a failing CLI command)*

Delegate to `test-runner` subagent:
```
Run: [exact failing command from input]
Expected: exits 0 with no errors
```

### Edge Cases to Test

- [specific edge case 1]
- [specific edge case 2]

---

## Success Criteria

**Must have:**
- [requirement 1]
- [requirement 2]
- All tests pass
- Static analysis passes
- Coverage meets thresholds

**Nice to have:**
- [optional enhancement]

---

## References

**Code Standards:**
.claude/shared/code-quality.md

**Design Doc:** [path if exists]

**Memories Referenced:**
- [memory_name] - [what was learned]

**Similar Implementations:**
- `file:symbol_path` - [serves as example for what]
```

---

## Notes

**Plan vs. Design:**
- **Design** (from `/brainstorming`): WHAT and WHY - architecture, trade-offs
- **Plan** (this document): HOW - step-by-step TDD tasks with exact code

**Required sections**: Context, Approaches, Tasks, Verification, Success Criteria
**Optional sections**: Reusable Components, References (skip if not applicable)

**Task granularity**: Each task = one TDD cycle (2-5 minutes)
**Test scaffold**: Every task must include a scaffold showing fixture pattern and arrange/act/assert skeleton
**Code completeness**: Every task must include actual implementation guidance, not descriptions
