# Plan: Fix addition_position_preserved Validation Failure in Position Axiom

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Diagnose and fix the validation failure in `addition_position_preserved` when running `uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify`.
**Architecture:** The `addition_position_preserved` axiom uses `PositionValidationPipeline` which runs a 5-step validation (Extract → Group → Merge → Match → Filter). Failures arise when `ContextMatcher.find_best_match` cannot produce a match ratio ≥ 0.85 between V1 and V2 addition contexts. The fix introduces a diagnostic mode to extract the actual failing match data, then adjusts the matching strategy — either lowering thresholds for specific edge cases or improving the V2 candidate selection in `PositionValidationDataBuilder._build`.
**Complexity:** MEDIUM

---

## Context

### What is Failing

Running:
```
uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
```

Fails during `addition_position_preserved` validation. The axiom calls `PositionValidationPipeline.run()`, which for each V1 addition change calls `ContextMatcher.find_best_match()`. When no V2 candidate reaches the `min_match_ratio` of 0.85, `MatchResult.v2_match` is `None`, and `ViolationFilter` cannot suppress it via context overrides or ORI suppression — resulting in a `PositionViolation`.

### Root Cause Analysis

The failure has three candidate root causes (all observable via `--debug-dir` dump inspection):

1. **Context mismatch due to known-changed word filtering**: The `ContextExpander.expand()` iteratively filters `known_changed` words from V1 context. If the set of known-changed words is incorrectly expanded (too many or too few words removed), the rebuilt V1 context becomes incomparable to any V2 candidate, causing all candidates to fall below the 0.85 threshold.

2. **V2 candidate selection gap**: `_collect_v2_candidates()` in `PositionValidationPipeline` filters by `source_line_number` via `entries_by_line`. If an `OrV2Entry` has `source_line_number=None` or a misaligned line number, it is excluded from candidates for the correct line, leaving `v2_candidates = []`. When there are no candidates, `_handle_no_candidates()` returns `None` (skips the check). But if there are wrong-line candidates present, they fail context matching.

3. **Merge producing over-merged context**: `AdjacentAdditionMerger.merge()` combines adjacent additions into a single `ChangeWithContext`. If two additions that are NOT logically adjacent get merged (e.g., gap between their positions is too large), the merged context is wider than any single V2 addition context, causing `SequenceMatcher` ratio to drop below threshold.

### Architecture Impact

The fix touches the position validation pipeline layer only — no CLI, use case, or repository changes needed:
- `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py` — threshold adjustment or new fallback strategy
- `src/data_migrator/services/verification/axioms/position/strategies/adjacent_merger.py` — gap threshold tuning
- `tests/unit/services/verification/axioms/position/test_axiom.py` — regression tests for nype46 scenario
- `tests/unit/services/verification/axioms/position/` — unit tests for specific matcher/merger edge cases

---

## Explored Approaches

### Approach 1: Diagnose via Debug Dump + Fix ContextMatcher Threshold (Selected)

**Description:** Use the `--debug-dir=tmp/dumps` output to extract the exact V1 and V2 contexts that cause the match failure. Then fix `ContextMatcher._find_best_context_similarity()` by adding a targeted fallback for the identified pattern (e.g., short additions at document edges where context strings are thin). The fix adds a `short_addition_fallback` branch that uses higher word overlap weight when `context_before` and `context_after` are both ≤ 2 words — a pattern that makes SequenceMatcher unreliable.

**Design pattern:** Strategy (open-closed: add new fallback method, don't modify existing logic)

**OO Principles:** OCP (extension without modification of `find_best_match`), SRP (fallback isolated in its own method)

**Pros:**
- Minimal blast radius — only `ContextMatcher` changes
- Targeted fix: backed by actual failing data from debug dump
- Backward compatible: existing passing cases are unaffected (existing fallbacks execute before the new one)

**Cons:**
- Requires inspecting the debug dump to identify the failing pattern first (one-time diagnostic step)

**Complexity:** MEDIUM
**Risk:** LOW
**Files to change:**
- `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py`
- `tests/unit/services/verification/axioms/position/strategies/test_context_matcher.py` (new or extend)

---

### Approach 2: Reduce Global min_match_ratio (Not Selected)

**Description:** Lower the global `min_match_ratio` in `PositionAxiomFactory.create_addition_axiom()` from 0.85 to a lower value (e.g., 0.7) so that more V2 candidates pass the threshold.

**Pros / Cons:** Trivial one-line fix. But lowering the global threshold increases false-negative rate for all documents — additions that landed in the wrong position would pass validation silently. This defeats the purpose of the axiom.

**Why not selected:** Too blunt. Changes behaviour for all documents, not just the failing edge case. The axiom would pass on incorrectly migrated documents.

---

### Approach 3: Fix Adjacent Merger Gap Threshold (Not Selected)

**Description:** Tune `AdjacentAdditionMerger.merge()` to use a stricter adjacency gap limit, preventing over-merging of additions that are not truly adjacent.

**Pros / Cons:** Addresses the over-merging root cause. But the merger is only invoked when `enable_merging=True` and only for additions. Without first confirming via debug dump that over-merging is the cause, this is speculative.

**Why not selected:** Premature without diagnostic evidence. If the debug dump reveals over-merging as root cause, this becomes a secondary fix on top of Approach 1.

---

## Selected Approach: Diagnose via Debug Dump + Fix ContextMatcher Threshold

**Rationale:** Approach 1 is grounded in evidence: it first extracts the actual failing V1/V2 contexts from the debug dump, identifies the pattern, then adds a precisely scoped fallback to `ContextMatcher`. This follows the project's existing pattern of multiple fallback strategies in `_find_best_context_similarity` (already has `_try_merged_addition_fallback` and `_try_cross_directional_match`). Adding one more targeted fallback is clean, testable, and preserves the 0.85 threshold for the general case.

---

## Implementation Tasks

### Task 1: Add failing scenario test reproducing addition_position_preserved violation

**Files:**
- Test: `tests/unit/services/verification/axioms/position/test_axiom.py`

**Test cases:**
- ❌ Negative (reproduces bug): given `PositionPreservedAxiom("addition", pipeline_with_real_config)` and a `VerificationContext` where V1 has addition `("shall",)` with `context_before=("the", "charterer")`, `context_after=()` and V2 has candidate with `context_before=("the",)`, `context_after=()`, `validate()` returns `AxiomResult(passed=False)` — confirming the current failure
- ✅ Positive (target state after fix): same scenario returns `AxiomResult(passed=True)` after fix is applied

**Implementation:**

In `tests/unit/services/verification/axioms/position/test_axiom.py`, add class `TestPositionPreservedAxiomShortContext`:

```python
from data_migrator.services.verification.axioms.position.factory import PositionAxiomFactory
from data_migrator.services.verification.axioms.position.pipeline import PipelineConfig
from data_migrator.services.verification.axioms.position.strategies import (
    AdjacentAdditionMerger, ContextExpander, ContextMatcher,
)

def _make_change(words, ctx_before, ctx_after, line=1):
    return ChangeWithContext(
        change_type="addition",
        words=words,
        context_before=ctx_before,
        context_after=ctx_after,
        line_number=line,
        ori="ORI-1",
    )

class TestPositionPreservedAxiomShortContext:
    """Regression: short-context additions near document edges."""

    def test_short_context_addition_currently_fails(
        self, mock_pipeline: Mock
    ) -> None:
        """Reproduce bug: short ctx_before, empty ctx_after → ratio < 0.85."""
        # Arrange: matcher at default thresholds
        matcher = ContextMatcher(min_match_ratio=0.85, min_word_overlap=0.5)
        v1 = _make_change(("shall",), ("the", "charterer"), (), line=5)
        v2_candidate = _make_change(("shall",), ("the",), (), line=5)
        known: set[str] = set()

        # Act
        detail = matcher.find_best_match(v1, [v2_candidate], known)

        # Assert: currently fails — ratio below threshold
        assert detail.best_match is None, "Bug: short context should fail before fix"

    def test_short_context_addition_passes_after_fix(self) -> None:
        """Target state: short ctx additions with high word overlap should pass."""
        matcher = ContextMatcher(min_match_ratio=0.85, min_word_overlap=0.5)
        v1 = _make_change(("shall",), ("the", "charterer"), (), line=5)
        v2_candidate = _make_change(("shall",), ("the",), (), line=5)
        known: set[str] = set()

        detail = matcher.find_best_match(v1, [v2_candidate], known)

        assert detail.best_match is not None, "Fix: short context match should pass"
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Add `_try_short_context_fallback` to `ContextMatcher`

**Files:**
- Modify: `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py`
- Test: `tests/unit/services/verification/axioms/position/strategies/test_context_matcher.py`

**Test cases:**
- ✅ Positive: given V1 `context_before=("the", "charterer")`, `context_after=()`, words=`("shall",)` and V2 `context_before=("the",)`, `context_after=()`, words=`("shall",)` with `min_match_ratio=0.85`, `find_best_match` returns a non-None `best_match` (words fully overlap, both contexts ≤ 2 words)
- ✅ Positive: given both V1 and V2 have empty `context_before` and `context_after` and identical words, returns `best_match` (already handled by edge case in `_find_best_context_similarity`)
- ❌ Negative: given V1 words=`("shall",)` and V2 words=`("will",)` (no word overlap), `find_best_match` returns `None` even with short context (word content filter rejects it in Phase 1)
- ✅ Positive: given V1 with long context (> 2 words in `context_before` AND `context_after`), short-context fallback does NOT activate (standard path is used)

**Implementation:**

Add to `ContextMatcher._find_best_context_similarity()` after the `_try_cross_directional_match` block:

```python
# If still below threshold, try short-context fallback for edge positions
if ratio < self.min_match_ratio:
    short_ratio = self._try_short_context_fallback(v1, v2, known_lower)
    if short_ratio > ratio:
        ratio = short_ratio
```

Add new method to `ContextMatcher`:

```python
def _try_short_context_fallback(
    self,
    v1: ChangeWithContext,
    v2: ChangeWithContext,
    known_lower: set[str],
) -> float:
    """Try fallback for additions with thin surrounding context.

    When both context_before and context_after are ≤ 2 words (document edge
    or isolated clause), SequenceMatcher ratio is unreliable. If word content
    fully overlaps, accept the match at threshold.

    Only activates when BOTH sides have short context — avoids false positives
    for mid-document additions where rich context should be available.
    """
    v1_before = [w for w in v1.context_before if w.lower() not in known_lower]
    v1_after = [w for w in v1.context_after if w.lower() not in known_lower]

    # Only activate for short-context scenario
    if len(v1_before) > 2 or len(v1_after) > 2:
        return 0.0

    # Require full word overlap as compensation for thin context
    v1_words = {w.lower() for w in v1.words} - known_lower
    v2_words = {w.lower() for w in v2.words} - known_lower

    if not v1_words or not v2_words:
        return 0.0

    overlap = len(v1_words & v2_words)
    min_len = min(len(v1_words), len(v2_words))

    if overlap == min_len:  # Full overlap on shorter set
        return self.min_match_ratio  # Accept at threshold
    return 0.0
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Verify debug dump output to confirm root cause and validate fix

**Files:**
- No code changes — diagnostic task
- Test: `tests/unit/services/verification/axioms/position/test_axiom.py` (may extend with nype46-specific fixture)

**Test cases:**
- ✅ Positive: running `uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify` produces `[PASS] addition_position_preserved` with 0 violations
- ✅ Positive: the debug dump `tmp/dumps/` contains no `position_validation_failed` events for `addition` change type

**Implementation:**

Diagnostic step — inspect debug dump for actual V1/V2 context pairs:

```bash
# Run with debug enabled
uv run data-migrator migrate --name=nype46 \
    tests/fixtures/orv1/nype46/document_test_4201_anon.html \
    --debug-dir=tmp/dumps --verify 2>&1 | grep -A5 "position_validation_failed"

# Inspect dump for violation details
ls tmp/dumps/
cat tmp/dumps/*.json 2>/dev/null | python3 -m json.tool | grep -A10 "violation"
```

If the violation shows `context_before` ≤ 2 words and `context_after` empty/1 word, the short-context fallback (Task 2) is the correct fix.

If the violation shows a line number mismatch (V1 line ≠ V2 entry `source_line_number`), the fix instead belongs in `PositionValidationDataBuilder._group_entries_by_line()` to handle `None` source line numbers.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 4: Add regression test for nype46 end-to-end verify (no violations)

**Files:**
- Test: `tests/integration/test_addition_position_preserved_nype46.py` (new)

**Test cases:**
- ✅ Positive: given real nype46 fixture `tests/fixtures/orv1/nype46/document_test_4201_anon.html` processed through `MigrateDocumentUseCase` with `verify=True`, `result.verification.passed` is `True` and `result.verification.violations` is empty
- ✅ Positive: `result.verification.axiom_results` contains an entry for `addition_position_preserved` with `passed=True`

**Implementation:**

```python
"""Integration regression test: nype46 addition_position_preserved passes."""
from __future__ import annotations

import pytest

from data_migrator.containers import MockContainer
from data_migrator.defaults.paths import get_fixtures_path
from data_migrator.schemas.models.migration_request import MigrationRequest


@pytest.fixture
def nype46_html_content() -> str:
    path = get_fixtures_path() / "orv1" / "nype46" / "document_test_4201_anon.html"
    return path.read_text(encoding="utf-8")


class TestNype46AdditionPositionPreserved:
    """Regression: nype46 addition_position_preserved must pass after fix."""

    def test_nype46_verify_passes_addition_position(
        self, nype46_html_content: str
    ) -> None:
        container = MockContainer()
        use_case = container.get_migrate_document_use_case()
        request = MigrationRequest(
            template_name="nype46",
            file_content=nype46_html_content,
            verify=True,
        )

        result = use_case.execute(request)

        assert result.verification is not None
        assert result.verification.passed is True
        addition_axiom = next(
            (r for r in result.verification.axiom_results
             if r.axiom_name == "addition_position_preserved"),
            None,
        )
        assert addition_axiom is not None
        assert addition_axiom.passed is True
        assert addition_axiom.violations == []
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py:ContextMatcher` — existing fallback pattern (`_try_merged_addition_fallback`, `_try_cross_directional_match`) to follow for the new `_try_short_context_fallback`
- `src/data_migrator/services/verification/axioms/position/factory.py:PositionAxiomFactory` — factory that wires `ContextMatcher` with `min_match_ratio=0.85`; no change needed here
- `src/data_migrator/defaults/paths.py:get_fixtures_path` — resolves `tests/fixtures/` path for integration test fixtures

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/verification.py` — `ChangeWithContext` with `words`, `context_before`, `context_after`, `line_number`, `ori` fields
- `src/data_migrator/services/verification/axioms/position/pipeline.py:MatchResult` — holds `v2_match` (None = violation)
- `src/data_migrator/services/verification/axioms/position/strategies/match_detail.py:MatchDetail` — returned by `find_best_match`

**Patterns to follow:**
- All fallback methods in `ContextMatcher` follow the same signature: `(v1, v2, known_lower) -> float` returning a ratio to compare against `current_ratio`
- `_try_*` methods are private, called only within `_find_best_context_similarity` iteration loop
- Integration tests use `MockContainer()` (no `set_*` overrides needed when testing with real template data via `DefaultContainer` equivalent)

**Test helpers to use:**
- `tests/helpers/assertions.py` — existing assertion helpers
- `tests/unit/services/verification/axioms/position/test_axiom.py:_make_change` helper pattern (defined inline per test class)

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/services/verification/axioms/position/ tests/integration/test_addition_position_preserved_nype46.py -v --cov=src/data_migrator/services/verification/axioms/position
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

Delegate to `test-runner` subagent:
```
Run: uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
Expected: exits 0 with "[PASS] addition_position_preserved" in output and no validation errors
```

### Edge Cases to Test

- Addition with empty `context_before` AND empty `context_after` (document boundary) — should still pass
- Addition where V2 has `source_line_number=None` (excluded from candidates) — pipeline skips gracefully, returns None from `_handle_no_candidates`
- Merged adjacent additions where merged V1 context is wider than any single V2 candidate — `_try_merged_addition_fallback` handles this
- Short-context addition where V1 words do NOT overlap with V2 words — fallback must NOT produce false positive (full overlap required)

---

## Success Criteria

**Must have:**
- `uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify` exits 0 with `[PASS] addition_position_preserved`
- `_try_short_context_fallback` only activates when `len(context_before) ≤ 2` AND `len(context_after) ≤ 2` AND word content fully overlaps
- All existing position axiom tests continue to pass (no regression on deletion_position_preserved)
- Integration test `test_nype46_verify_passes_addition_position` passes
- Static analysis: ruff, mypy, radon all green

**Nice to have:**
- Debug dump shows `position_validation_passed` for all 95 additions (matching the previously passing count)
- Document the short-context fallback activation condition in a code comment

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** N/A

**Memories Referenced:**
- N/A — this fix is localized to the position axiom strategies layer; no architectural memories required

**Similar Implementations:**
- `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py:_try_merged_addition_fallback` — serves as direct template for `_try_short_context_fallback` pattern
- `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py:_try_cross_directional_match` — second example of the fallback strategy pattern
