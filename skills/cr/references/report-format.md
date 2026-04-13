# Code Review Report Format

The final merged report uses the following 14-section structure.

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
| 14. Baseline Comparison | Baseline comparator (skipped for tiny changes) |

---

## Report Sections

### 1. Summary
≤ 5 sentences: overall assessment, severity distribution, key wins/gaps.

### 2. Style & Conventions
**Checklist** (✓/✗ + brief reason):
- Naming (variables, functions, classes)
- PEP 8 compliance (ruff-verified)
- Import organization & clarity
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
- Coverage ≥80% for critical paths
- Edge cases tested
- Test names semantically match what they assert
- No near-duplicate tests (parametrize where appropriate)
- Tests are isolated (no order dependency, no shared mutable state)
- Assertions are specific (no overly broad `assert result is not None`)

**Recommendations**: `file:line` → issue → fix.

_(Populated from test-reviewer + test-runner + layer-group reviewer TESTS_GAPS output)_

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
- **Extract to**: `path/to/module.py::ClassName/function_name` — concrete target
- **Benefit**: why extraction improves the codebase (maintainability, consistency, testability)

**Common extraction targets:**
- Repeated validation logic → helper function in `utils/` or `validators.py`
- Similar transformer/processor methods → base class with template method pattern
- Repeated exception handling → decorator or context manager
- Duplicated test setup/assertions → `tests/helpers/factories.py` or `tests/helpers/assertions.py`
- Similar loop/filter patterns → extracted generator or utility function
- Repeated Pydantic model conversions → static `from_*()` factory methods

### 9. Dead Code Detection

Paste the dead-code-detector agent's output **verbatim** here. Do NOT reformat, summarize, or rewrite it.
The agent produces structured `DEAD_CODE_FINDINGS` / `DELETION_PLAN` blocks with pre-filled `delete_lines` calls — these must be preserved exactly so the caller can execute them without re-reading files.

### 10. Security
- SQL injection risks (✓/✗)
- Unsafe deserialization (✓/✗)
- Secrets/credentials in code (✓/✗)

### 11. Architecture

**Layer boundaries** (`[CLI] → [Use Cases] → [Services] → [Processors + Repository + Schemas]`):
- No upward imports (e.g. service importing from CLI, processor importing from use case) (✓/✗)
- CLI commands create `DefaultContainer` and delegate to use cases only (✓/✗)
- Use cases orchestrate services, never contain business logic themselves (✓/✗)

**Dependency injection**:
- Dependencies injected via constructor, not created internally (✓/✗)
- No global/shared mutable state (✓/✗)
- Tests use `MockContainer` to swap dependencies (✓/✗)

**Design patterns**:
- Strategy pattern used for pluggable components (parsers, loaders) (✓/✗)
- Repository pattern for storage abstraction (no direct file I/O in services) (✓/✗)
- Pydantic models use `FrozenModel` / `frozen=True` for immutability (✓/✗)
- `from __future__ import annotations` present in all Pydantic model files (✓/✗)

**Data flow**:
- Data flows unidirectionally: HTML → tokens → SourceDocument → transformations → output (✓/✗)
- No circular dependencies between modules (✓/✗)
- Custom exceptions from `exceptions.py` with structlog before raising (✓/✗)

**Violations** (if any): `file:line` → which rule is broken → suggested fix.

### 12. Positive Observations
Good patterns worth reinforcing.

### 13. All Issues
All problems found across all agents, sorted by severity descending (CRITICAL → HIGH → MEDIUM → LOW).

Each issue: **[SEVERITY] category** → `file:line` → problem → 1-sentence fix.

### 14. Baseline Comparison

_(Skipped for tiny changes — run `baselines dump` first if no snapshots exist)_

Paste the baseline-comparator agent's output **verbatim** here. Do NOT reformat or summarize.

**Status line format:**
- `✅ UNCHANGED` — migration output matches baseline for all fixtures
- `⚠️ CHANGED ({N} fixtures)` — output differs from baseline; list changed fixture names
- `❌ FAILED` — command failed (show error output)
- `⬜ NO BASELINE` — no snapshots found in `var/snapshots/`

If status is `⚠️ CHANGED`, include the diff summary from the comparator output so the reviewer knows whether the change is intentional or a regression.
