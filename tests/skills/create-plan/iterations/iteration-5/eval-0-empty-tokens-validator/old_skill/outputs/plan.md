# Plan: Add Empty Tokens Validator Before Processing

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Raise a descriptive exception when `BaseTokenizerParser.parse()` produces an empty tokens list, preventing silent downstream failures.
**Architecture:** Add `EmptyTokensError` to `exceptions.py`, then add a `_validate_tokens_not_empty()` guard in `BaseTokenizerParser.parse()` called after `_extract_lines()` returns.
**Complexity:** LOW

---

## Context

Currently `BaseTokenizerParser.parse()` may return a `SourceDocument` with an empty `lines` dict and zero total tokens without any indication of why. Downstream services such as `TokenAlignmentService`, `DocumentPositionIndexDiff`, and `LineTransformer` silently produce empty results or behave incorrectly when the token list is empty. Adding an explicit guard at the parser level surfaces this problem immediately with a descriptive message that includes the parser name, making debugging much faster.

The guard lives in `BaseTokenizerParser` so it covers all parser implementations (`FroalaParser`, `SeaParser`, and any future parsers) uniformly, without duplicating logic.

The existing `TokenTypeValidator.validate_include_types` in `services/text_processing/validators.py` shows the established pattern: raise a domain exception with a structlog error call before raising. `exceptions.py` already defines the exception hierarchy (`DataMigratorError` → `HtmlParseError`, `ParserNotFoundError`, etc.) so we add `EmptyTokensError` to that hierarchy.

---

## Explored Approaches

### Approach 1: Guard in BaseTokenizerParser.parse() (Selected)

**Description:** After `_extract_lines()` returns, compute total token count across all lines. If it is zero, log a structured error and raise `EmptyTokensError` with the parser name in the message. The check is one method call: `self._validate_tokens_not_empty(lines)`.

**Design pattern:** Template Method — `parse()` is the sealed orchestrator; the guard fits naturally as a post-extraction step.

**OO principles:** SRP (guard is one private method), OCP (subclasses are unaffected), DIP (no new dependencies).

**Pros:**
- Single point of truth — all parsers covered without duplication
- Consistent with existing structlog-then-raise pattern in codebase
- Minimal diff: one new exception class, one private method, one call site

**Cons:**
- Legitimate zero-token documents (truly blank files) would now raise instead of returning silently — callers must handle `EmptyTokensError` or the `FroalaParser` test `test_empty_html` must be updated to expect the exception

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/exceptions.py`
- `src/data_migrator/processors/tokenizers/base_parser.py`
- `tests/unit/processors/tokenizers/froala/test_froala_parser.py` (update `test_empty_html`)
- `tests/unit/processors/tokenizers/test_base_parser.py` (new test file)

---

### Approach 2: Validation in SourceDocumentParser.parse_content() (Not Selected)

**Description:** Add the guard one layer up in `SourceDocumentParser.parse_content()` immediately after calling `parser.parse()`. This keeps `BaseTokenizerParser` unchanged and moves the validation responsibility to the service layer.

**Pros / Cons:** Avoids touching `BaseTokenizerParser` directly. However, it duplicates nothing and misses the case where parsers are used directly (e.g., in tests or future CLI commands that bypass `SourceDocumentParser`).

**Why not selected:** The validation is logically about the parser's output contract, not the caller's concern. Placing it at the parser level gives earlier, more accurate error messages and covers all call paths.

---

### Approach 3: Pydantic field_validator on SourceDocument (Not Selected)

**Description:** Add a `field_validator` to `SourceDocument` that raises if `lines` is empty or if total token count is zero.

**Pros / Cons:** Enforcement is automatic everywhere `SourceDocument` is constructed. However, `SourceDocument` is also constructed in test fixtures, migration statistics, and verification services with legitimately empty lines — e.g., an empty section document during partial migration. This would cause widespread test breakage and is architecturally inappropriate (data model should not enforce business rules).

**Why not selected:** Violates SRP — data schemas should not encode business-level parse rules. Too broad, high risk of unintended failures.

---

## Selected Approach: Guard in BaseTokenizerParser.parse()

**Rationale:** Lowest risk, minimal diff, single responsibility. Follows the exact structlog-then-raise pattern already used by `TokenTypeValidator` and `ImportTemplateUseCase._validate_template_name`. All parsers are guarded uniformly by the base class template method.

---

## Implementation Tasks

### Task 1: Add EmptyTokensError to exceptions.py

**Files:**
- Modify: `src/data_migrator/exceptions.py`
- Test: `tests/unit/test_exceptions.py` (create if missing; check with `find tests/ -name test_exceptions.py`)

**Test cases:**
- ✅ Positive: `EmptyTokensError` is a subclass of `DataMigratorError`
- ✅ Positive: instantiating `EmptyTokensError("FroalaParser")` stores message with parser name
- ✅ Positive: `EmptyTokensError` can be caught as `DataMigratorError`

**Test scaffold:**
```python
# Setup: no fixture needed
def test_empty_tokens_error_is_data_migrator_error():
    err = EmptyTokensError("FroalaParser produced 0 tokens")
    assert isinstance(err, DataMigratorError)
    assert "FroalaParser" in str(err)
```

**Implementation:**
```python
class EmptyTokensError(DataMigratorError):
    """Raised when parser produces zero tokens from the input document."""
    pass
```
Add after `HtmlParseError` (line ~136 in current `exceptions.py`).

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Add _validate_tokens_not_empty() guard to BaseTokenizerParser

**Files:**
- Modify: `src/data_migrator/processors/tokenizers/base_parser.py`
- Create: `tests/unit/processors/tokenizers/test_base_parser.py`

**Test cases:**
- ✅ Positive: given a concrete subclass whose `_extract_lines()` returns a non-empty dict with tokens, `parse()` returns `SourceDocument` without raising
- ❌ Negative: given a concrete subclass whose `_extract_lines()` returns an empty dict `{}`, `parse()` raises `EmptyTokensError` with parser name in message
- ❌ Negative: given a subclass whose `_extract_lines()` returns lines where all lines have empty token lists, `parse()` raises `EmptyTokensError`

**Test scaffold:**
```python
# Setup: no fixture, inline stub subclass
from data_migrator.exceptions import EmptyTokensError
from data_migrator.processors.tokenizers.base_parser import BaseTokenizerParser
from data_migrator.schemas.models.document import SourceLine
from data_migrator.schemas.models.token import SourceToken, TokenType, ChangeType

class _StubParser(BaseTokenizerParser):
    parser_name = "StubParser"
    def __init__(self, lines):
        super().__init__("<html/>")
        self._lines = lines
    def _extract_lines(self, soup, token_filter=None):
        return self._lines

def test_raises_empty_tokens_error_on_empty_lines():
    parser = _StubParser(lines={})
    with pytest.raises(EmptyTokensError, match="StubParser"):
        parser.parse()

def test_raises_empty_tokens_error_when_all_lines_have_no_tokens():
    lines = {1: SourceLine(line_number=1, tokens=[])}
    parser = _StubParser(lines=lines)
    with pytest.raises(EmptyTokensError, match="StubParser"):
        parser.parse()

def test_does_not_raise_when_tokens_present():
    token = SourceToken(type=TokenType.TEXT, value="hello", text_type=ChangeType.BLACK)
    lines = {1: SourceLine(line_number=1, tokens=[token])}
    parser = _StubParser(lines=lines)
    doc = parser.parse()
    assert len(doc.lines) == 1
```

**Implementation:**

Add import at top of `base_parser.py`:
```python
from data_migrator.exceptions import EmptyTokensError
```

Add private method to `BaseTokenizerParser`:
```python
def _validate_tokens_not_empty(self, lines: dict[int, SourceLine]) -> None:
    """Raises:
        EmptyTokensError: If total token count across all lines is zero.
    """
    total = sum(len(line.tokens) for line in lines.values())
    if total == 0:
        logger.error("empty_tokens_after_parse", parser=self.parser_name, line_count=len(lines))
        raise EmptyTokensError(
            f"{self.parser_name} produced 0 tokens from the input document"
        )
```

Call it in `parse()` immediately after `_extract_lines`:
```python
lines = self._extract_lines(soup, token_filter)
self._validate_tokens_not_empty(lines)   # ← new line
metadata = self._build_metadata()
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Update existing FroalaParser edge case tests

**Files:**
- Modify: `tests/unit/processors/tokenizers/froala/test_froala_parser.py`

**Test cases:**
- ❌ Negative: `FroalaParser("", "utf-8").parse()` raises `EmptyTokensError` (was: returns empty `SourceDocument`)
- ❌ Negative: `FroalaParser("<div>Just a div</div>", "utf-8").parse()` raises `EmptyTokensError` (was: returns empty `SourceDocument`)

**Test scaffold:**
```python
# Setup: no fixture
import pytest
from data_migrator.exceptions import EmptyTokensError

class TestFroalaParserEdgeCases:
    def test_empty_html_raises(self) -> None:
        parser = FroalaParser("", "utf-8")
        with pytest.raises(EmptyTokensError, match="FroalaParser"):
            parser.parse()

    def test_no_extractable_content_raises(self) -> None:
        parser = FroalaParser("<div>Just a div</div>", "utf-8")
        with pytest.raises(EmptyTokensError, match="FroalaParser"):
            parser.parse()
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/exceptions.py:DataMigratorError` - base class for `EmptyTokensError`
- `src/data_migrator/processors/tokenizers/base_parser.py:BaseTokenizerParser._log_metrics` - already computes `token_count`, same pattern as the new guard

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/document.py` - `SourceLine.tokens`, `SourceDocument`

**Patterns to follow:**
- structlog error call → raise domain exception (see `TokenTypeValidator.validate_include_types`, `ImportTemplateUseCase._check_files_exist`)
- Private validation methods on service/parser classes (single-responsibility extraction)

**Test helpers to use:**
- Inline stub subclass pattern (no shared fixture needed for unit test)

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/processors/tokenizers/ tests/unit/test_exceptions.py -v --cov=src/data_migrator/processors/tokenizers/base_parser --cov=src/data_migrator/exceptions
Coverage targets:
  - Critical paths (base_parser.py): >90%
  - Business logic (EmptyTokensError path): 100%
```

### Code Quality

Delegate to `static-analyse` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Edge Cases to Test

- Document with only whitespace-only tokens (all normalized away by `TextNormalizer`) — currently those tokens are pruned by `_normalize_and_prune` in `TokenPipeline` before reaching `_extract_lines`, so count stays zero
- Document with only PLACEHOLDER tokens (no TEXT tokens) — must NOT raise, placeholders are valid tokens
- SEA parser with empty input — covered by the base class guard automatically

---

## Success Criteria

**Must have:**
- `EmptyTokensError` subclasses `DataMigratorError` and is importable from `data_migrator.exceptions`
- `BaseTokenizerParser.parse()` raises `EmptyTokensError` with parser name in message when total token count is zero
- Existing `test_empty_html` and `test_no_extractable_content` tests updated to expect `EmptyTokensError`
- New unit tests for `BaseTokenizerParser` validation guard covering empty-lines, all-empty-token-lists, and non-empty paths
- All tests pass
- Static analysis passes
- Coverage meets thresholds

**Nice to have:**
- Add `EmptyTokensError` to the `__all__` export in `exceptions.py` if one exists

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found

**Memories Referenced:**
- None loaded (task is localized, code read directly)

**Similar Implementations:**
- `src/data_migrator/services/text_processing/validators.py:TokenTypeValidator.validate_include_types` - serves as example for structlog-then-raise validation pattern
- `src/data_migrator/processors/tokenizers/base_parser.py:BaseTokenizerParser._log_metrics` - already iterates lines/tokens with the same comprehension pattern used by the guard
