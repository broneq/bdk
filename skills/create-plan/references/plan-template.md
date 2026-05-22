# Plan Template

Use when writing to `.bdk/plans/YYYY-MM-DD-HHMM-<slug>.md`.

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

[2-3 paragraphs:
- What feature does and why needed
- How fits into existing architecture
- Related design docs (if in .bdk/design/)
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

**Rationale:** [Why best, referencing pros/cons]

---

## Implementation Tasks

### Task 1: [Action verb + what]

**Files:**
- Create: `exact/path/to/new_file.[ext]`
- Modify: `exact/path/to/existing.[ext]`
- Test: `tests/exact/path/test_file.[ext]`

**Test cases:**
- ✅ Positive: given [input], expects [output]
- ✅ Positive: given [edge case input], expects [edge case output]
- ❌ Negative: given [invalid input], raises [error] *(omit if no meaningful failure mode)*

**Test scaffold:**
```
// language-agnostic pseudocode — write in the project's language/framework

// Setup: [fixture or setup needed, e.g. "none", "mock repo", "test container"]

// test: [name matching first case]
//   arrange: [concrete input]
//   act:     [call under test]
//   assert:  [expected output or side effect]

// test: [name matching second case]
//   [...]

// CLI regression tasks: replace stubs with:
//   run [command] — expect exit 0, no errors
```

**Implementation:** [class name, method signature, key logic]

> Follow `/bdk:test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: [Next component]

[Same structure as Task 1]

---

[Continue for all tasks — each task: 2-5 minutes]

---

## Reusable Components

**Existing utilities:**
- `file:symbol_path` - [what it does]

**Relevant schemas/models:**
- `file_path` - [what it defines]

**Patterns to follow:**
- [pattern from existing codebase]

**Test helpers:**
- `file:function_path` - [what it does]

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run the project's test suite against the relevant paths for this feature.
Use the test command from `.bdk/settings.json` (injected at session start), or detect from project if not configured.

Target: [specific test paths or modules]
```

### Code Quality

Delegate to `static-analyse` subagent:
```
Run the project's lint/format/type-check commands.
Use the lint command from `.bdk/settings.json` (injected at session start), or detect from project if not configured.
```

### Regression

*(Only if input provided a failing CLI command)*

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

<!-- INJECT: code-quality -->

**Architecture Principles:**

<!-- INJECT: architecture -->

**Design Patterns:**

<!-- INJECT: design-patterns -->

**Design Doc:** [path if exists]

**Memories Referenced:**
- [memory_name] - [what was learned]

**Similar Implementations:**
- `file:symbol_path` - [serves as example for what]
```

---

## Notes

**Plan vs. Design:**
- **Design** (from `/bdk:design`): WHAT and WHY — architecture, trade-offs
- **Plan** (this doc): HOW — step-by-step TDD tasks with exact code

**Required sections**: Context, Approaches, Tasks, Verification, Success Criteria
**Optional sections**: Reusable Components, References (skip if not applicable)

**Task granularity**: each task = one TDD cycle (2-5 min)
**Test scaffold**: every task must include fixture pattern + arrange/act/assert skeleton
**Code completeness**: every task must include actual implementation guidance, not descriptions
