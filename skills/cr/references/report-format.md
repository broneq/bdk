# Code Review Report Format

13-section merged report structure.

## Section Mapping

| Report Section | Source Agent(s) |
|----------------|-----------------|
| 1. Summary | Synthesize all agent findings |
| 2. Style & Conventions | Layer-group reviewers |
| 3. Functionality & Logic | Layer-group reviewers |
| 4. Performance | Layer-group reviewers |
| 5. Tests | Test-reviewer + test-runner + layer-group reviewers |
| 6. Type Hints & SOLID | Layer-group reviewers |
| 7. Object-Oriented Design | Layer-group reviewers |
| 8. Duplicate Code | Duplicate detector(s) — or layer-group if tiny |
| 9. Dead Code | Dead code detector — or layer-group if tiny |
| 10. Security | Layer-group reviewers (embedded checklist) |
| 11. Architecture | Architecture reviewer — or layer-group if tiny |
| 12. Positive Observations | All agents |
| 13. All Issues | All agents → all findings, sorted by severity (CRITICAL → HIGH → MEDIUM → LOW) |

Checklists below are language-agnostic on purpose. Resolve each item against the project's **own** conventions - its linter config, its layer names, its patterns - discovered from project context, never from an assumed stack. A checklist item that names a specific tool or framework has drifted and should be generalized rather than answered.

---

## Report Sections

### 1. Summary
≤ 5 sentences: overall assessment, severity distribution, key wins/gaps.

### 2. Style & Conventions
**Checklist** (✓/✗ + brief reason):
- Naming (variables, functions, classes)
- Conforms to the project's own style guide, as enforced by its formatter/linter
- Import/dependency organization & clarity
- Code consistency across codebase

**Recommendations** (max 3): `file:line` → issue → fix.

### 3. Functionality & Logic
**Checklist** (✓/✗ + brief reason):
- Correctness
- Error handling
- Edge cases (empty inputs, None, boundaries)
- No logic errors (off-by-one, infinite loops)

**Recommendations** (max 5): `file:line` → issue → fix + optional snippet (≤5 lines).

### 4. Performance
**Checklist** (✓/✗):
- Algorithm choices sensible
- No unnecessary iterations
- No redundant ops in hot paths

**Findings** (if any): `file:function` → bottleneck → suggestion.

### 5. Tests
**Checklist** (✓/✗):
- Unit tests exist
- Integration tests where needed
- Critical paths covered (against the project's own coverage threshold, if it declares one)
- Edge cases tested
- Test names semantically match what they assert
- No near-duplicate tests (parametrize where appropriate)
- Tests are isolated (no order dependency, no shared mutable state)
- Assertions are specific (no overly broad `assert result is not None`)

**Recommendations**: `file:line` → issue → fix.

_(Populated from test-reviewer + test-runner + layer-group reviewer TEST_GAPS output)_

### 6. Type Hints & SOLID
- Type hints on all public APIs (✓/✗)
- TypeAlias for complex types (✓/✗)
- Single responsibility (✓/✗)
- Notable SOLID violations (if any)

### 7. Object-Oriented Design
**Checklist** (✓/✗ + brief reason):
- Uses classes and methods, NOT standalone procedural functions
- Each class has single, well-defined responsibility (SRP)
- Composition over inheritance where appropriate
- Dependency injection for external dependencies (no hardcoded instantiation)
- No god classes (classes with too many responsibilities)
- No anemic models (classes with only data, no behavior)
- Avoids premature abstraction: "three similar lines better than premature abstraction"

**Violations** (if any): `file:line` → anti-pattern → suggested refactoring.

### 8. Duplicate Code & Pattern Extraction
**Checklist** (✓/✗):
- No repeated code blocks (>5 lines) across files
- Common patterns extracted into helpers/utilities
- Shared logic centralized (not copy-pasted)
- Similar class/method implementations consolidated

**Findings** (if any): `file:line` & `file:line` → duplicated code description → suggested extraction → target location.

**Pattern Extraction Recommendations** (if any):
Each recommendation includes:
- **Files affected**: list of files containing the duplicate
- **Pattern**: brief description of the repeated logic
- **Extract to**: concrete target — an existing module and symbol in this project, or a named new one alongside its peers
- **Benefit**: why extraction improves the codebase (maintainability, consistency, testability)

**Common extraction shapes** (name the project's own equivalent, not a generic one):
- Repeated validation logic → a shared helper next to the other helpers
- Similar transformer/processor implementations → a common base with the varying step overridden
- Repeated error handling → the language's wrapping idiom (decorator, middleware, context manager, defer)
- Duplicated test setup or assertions → a test factory/helper in the project's test-support location
- Similar loop/filter chains → one named utility
- Repeated data-shape conversions → a factory or constructor on the type itself

### 9. Dead Code Detection

Paste dead-code-detector agent output **verbatim**. Do NOT reformat, summarize, or rewrite.
Agent produces structured `DEAD_CODE_FINDINGS` / `DELETION_PLAN` blocks with pre-filled `delete_lines` calls — preserve exactly so caller can execute without re-reading files.

### 10. Security
- SQL injection risks (✓/✗)
- Unsafe deserialization (✓/✗)
- Secrets/credentials in code (✓/✗)

### 11. Architecture

Resolve this project's actual layering first (from its directory structure, its architecture rules, or `bdk:architecture-reviewer`'s own reading), state it in the report, then check against it. Do not assume a layer stack.

**Layer boundaries** (state the resolved layering, e.g. `[entrypoint] → [orchestration] → [domain] → [infrastructure]`):
- No upward imports: an inner layer never depends on an outer one (✓/✗)
- Entrypoints wire dependencies and delegate; they hold no business logic (✓/✗)
- Orchestration coordinates; the logic itself lives in the domain layer (✓/✗)

**Dependency injection**:
- Dependencies passed in, not constructed internally (✓/✗)
- No global or shared mutable state (✓/✗)
- Tests can substitute dependencies without patching internals (✓/✗)

**Design patterns** (only the ones this project actually uses):
- Pluggable components go through one declared extension point, not scattered conditionals (✓/✗)
- Storage and I/O sit behind an abstraction; the domain layer performs none directly (✓/✗)
- Data carriers are immutable where the language supports it (✓/✗)
- The project's declared conventions for its own model/type definitions are followed (✓/✗)

**Data flow**:
- Data flows in one direction through the pipeline; state the actual stages (✓/✗)
- No circular dependencies between modules (✓/✗)
- Errors surface as the project's own error types, logged through its own logger, before propagating (✓/✗)

**Violations** (if any): `file:line` → which rule is broken → suggested fix.

### 12. Positive Observations
Good patterns worth reinforcing.

### 13. All Issues
All problems across all agents, sorted severity descending (CRITICAL → HIGH → MEDIUM → LOW).

Each issue: **[SEVERITY] category** → `file:line` (symbol, when the finding has one) → problem → 1-sentence fix.

One row per **merged** finding, and `category` is one of the engine's ten slugs. The array reaching this section is already deduplicated by `(file, category, symbol-or-nearby-line)`; do not re-expand it back to per-agent rows, and derive the header's severity counts from the same rows so the count and the list agree.

---

## Header and scope block

Every report opens with what was reviewed, before section 1:

```markdown
# Code Review: <branch>

**Range**: `<anchor>..<head>` (<delta|full> — <anchor_source>), <N> commits
**Files**: <N> reviewed<, plus M as cumulative context on a delta pass>
**Size class**: tiny | small | large | massive
**Agents**: <N> dispatched<, M degraded: names>
**Suppressed**: <N> previously deferred findings withheld from reviewers
```

Omit nothing here. A report that does not say it was a delta pass reads as a full review of the branch, which is the one misreading that turns a clean report into a false assurance.

## Deferred findings block

With a run, close the report with what was previously triaged and declined:

```markdown
## Deferred — not auto-fixed

| Severity | Category | Location | Problem |
|---|---|---|---|
```

Sourced from `bdk_run_state.py findings-list`. These were withheld from this pass's reviewers on purpose; listing them keeps the report honest about the branch's actual state rather than about what was re-detected.