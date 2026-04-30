# Plan: Add Empty Tokens Validator Before Processing

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Raise a descriptive `EmptyTokensError` when `BaseTokenizerParser.parse()` produces zero tokens, preventing silent downstream failures.
**Architecture:** Add `EmptyTokensError` to `exceptions.py`, add a `_validate_tokens_not_empty()` private guard in `BaseTokenizerParser.parse()` immediately after `_extract_lines()` returns, and update existing tests that expect empty `SourceDocument` to expect the exception instead.
**Complexity:** LOW

---

## Context

Currently `BaseTokenizerParser.parse()` may return a `SourceDocument` with an empty `lines` dict and zero total tokens with no indication of why. Downstream services — `UnmarkedChangeDetector`, `LineTransformer`, and `DocumentMigrationService` — silently produce empty results or iterate over nothing when the token list is empty. Surfacing the problem at the parser level with a descriptive exception (including parser name and document stats) allows developers to identify the root cause immediately rather than chasing empty-output bugs through multiple service layers.

The guard lives in `BaseTokenizerParser` so it covers all concrete parsers (`FroalaParser`, `SeaContractsParser`, and any future parsers) uniformly through the Template Method pattern, without any duplication. The `_log_metrics()` method already iterates `lines.values()` and sums token counts using the identical comprehension, so the new guard reuses the same logic.

The established codebase pattern for validation is: log a structured error via `structlog`, then raise a domain exception that subclasses `DataMigratorError`. `TokenTypeValidator.validate_include_types` in `services/text_processing/validators.py` is the canonical example of this pattern.

---

## Explored Approaches

### Approach 1: Guard in BaseTokenizerParser.parse() (Selected)

**Description:** After `_extract_lines()` returns, compute total token count across all lines. If it is zero, log a structured error and raise `EmptyTokensError` with the parser name embedded in the message. The check is encapsulated in one private method: `self._validate_tokens_not_empty(lines)`.

**Design pattern:** Template Method — `parse()` is the sealed orchestrator; the guard fits naturally as a post-extraction validation step, consistent with the existing `_log_metrics()` step.

**OO principles:** SRP (validation extracted to dedicated private method), OCP (subclasses require no changes), DIP (no new external dependencies).

**Pros:**
- Single point of truth — all current and future parsers are covered without any duplication
- Consistent with the existing structlog-then-raise pattern used by `TokenTypeValidator` and `ImportTemplateUseCase`
- Minimal diff: one new exception class + one private method + one call site

**Cons:**
- Legitimate truly-blank documents (e.g., whitespace-only HTML) will now raise instead of silently returning empty — callers that currently tolerate empty results must handle `EmptyTokensError` or update tests

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/exceptions.py`
- `src/data_migrator/processors/tokenizers/base_parser.py`
- `tests/unit/processors/tokenizers/test_base_parser.py`
- `tests/unit/processors/tokenizers/froala/test_froala_parser.py`

---

### Approach 2: Guard in SourceDocumentParser.parse_content() (Not Selected)

**Description:** Add the empty-token check one layer up in `SourceDocumentParser.parse_content()` after calling `parser.parse()`. `BaseTokenizerParser` is unchanged.

**Pros / Cons:** Avoids touching the base parser. However, parsers used directly (in tests or future CLI paths that bypass `SourceDocumentParser`) would produce silent empty results. The validation is logically about the parser's output contract, not the caller's responsibility.

**Why not selected:** Misses direct parser call paths; violates the principle that postcondition guards belong at the boundary that owns the contract.

---

### Approach 3: Pydantic field_validator on SourceDocument (Not Selected)

**Description:** Add a `@field_validator("lines")` to `SourceDocument` that raises if total token count is zero.

**Pros / Cons:** Automatically enforced at construction. However, `SourceDocument` is constructed with legitimately empty `lines` in test fixtures, partial migration contexts, and statistics helpers — causing widespread unintended failures.

**Why not selected:** Violates SRP — data schemas should not encode parser-level business rules. Scope is too broad, risk of false positives is HIGH.

---

## Selected Approach: Guard in BaseTokenizerParser.parse()

**Rationale:** Lowest risk, minimal diff, single responsibility. Follows the exact structlog-then-raise pattern used by `TokenTypeValidator.validate_include_types`. All parsers are guarded uniformly through the existing Template Method base class without duplication.

---

## Implementation Tasks

### Task 1: Add EmptyTokensError to exceptions.py

**Files:**
- Modify: `src/data_migrator/exceptions.py`
- Test: `tests/unit/test_exceptions.py` (create if not present)

**Test cases:**
- ✅ Positive: `EmptyTokensError("FroalaParser")` is an instance of `DataMigratorError`
- ✅ Positive: `str(EmptyTokensError("FroalaParser produced 0 tokens"))` contains `"FroalaParser"`
- ✅ Positive: `EmptyTokensError` can be caught with `except DataMigratorError`

**Test scaffold:**
```python
# Setup: no fixture needed
import pytest
from data_migrator.exceptions import DataMigratorError, EmptyTokensError

def test_empty_tokens_error_is_data_migrator_error():
    err = EmptyTokensError("FroalaParser produced 0 tokens")
    assert isinstance(err, DataMigratorError)

def test_empty_tokens_error_stores_message_with_parser_name():
    err = EmptyTokensError("FroalaParser produced 0 tokens")
    assert "FroalaParser" in str(err)

def test_empty_tokens_error_catchable_as_base():
    with pytest.raises(DataMigratorError):
        raise EmptyTokensError("FroalaParser produced 0 tokens")
```

**Implementation:**

Add the following class to `src/data_migrator/exceptions.py`, after `HtmlParseError` (currently around line 136):

```python
class EmptyTokensError(DataMigratorError):
    """Raised when parser produces zero tokens from the input document."""

    pass
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Add _validate_tokens_not_empty() guard to BaseTokenizerParser

**Files:**
- Modify: `src/data_migrator/processors/tokenizers/base_parser.py`
- Modify: `tests/unit/processors/tokenizers/test_base_parser.py`

**Test cases:**
- ✅ Positive: given a subclass whose `_extract_lines()` returns a line with at least one token, `parse()` returns a `SourceDocument` without raising
- ❌ Negative: given a subclass whose `_extract_lines()` returns an empty dict `{}`, `parse()` raises `EmptyTokensError` with the parser name in the message
- ❌ Negative: given a subclass whose `_extract_lines()` returns `{1: SourceLine(line_number=1, tokens=[])}` (one line, zero tokens), `parse()` raises `EmptyTokensError`

**Test scaffold:**
```python
# Setup: no fixture needed — inline stub subclasses
import pytest
from data_migrator.exceptions import EmptyTokensError
from data_migrator.processors.tokenizers.base_parser import BaseTokenizerParser
from data_migrator.schemas.models.document import SourceLine
from data_migrator.schemas.models.token import ChangeType, SourceToken, TokenType


class _StubParser(BaseTokenizerParser):
    def __init__(self, lines: dict) -> None:
        super().__init__("<html/>")
        self._lines = lines

    @property
    def parser_name(self) -> str:
        return "StubParser"

    def _extract_lines(self, soup, token_filter=None):
        return self._lines


def test_parse_raises_empty_tokens_error_for_empty_lines_dict():
    parser = _StubParser(lines={})
    with pytest.raises(EmptyTokensError, match="StubParser"):
        parser.parse()


def test_parse_raises_empty_tokens_error_when_all_lines_have_no_tokens():
    lines = {1: SourceLine(line_number=1, tokens=[])}
    parser = _StubParser(lines=lines)
    with pytest.raises(EmptyTokensError, match="StubParser"):
        parser.parse()


def test_parse_does_not_raise_when_tokens_are_present():
    token = SourceToken(type=TokenType.TEXT, value="hello", text_type=ChangeType.BLACK)
    lines = {1: SourceLine(line_number=1, tokens=[token])}
    parser = _StubParser(lines=lines)
    doc = parser.parse()
    assert len(doc.lines) == 1
```

**Implementation:**

Add import at the top of `src/data_migrator/processors/tokenizers/base_parser.py`:
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
        logger.error(
            "empty_tokens_after_parse",
            parser=self.parser_name,
            line_count=len(lines),
        )
        raise EmptyTokensError(
            f"{self.parser_name} produced 0 tokens from the input document"
        )
```

Update `parse()` to call the guard immediately after `_extract_lines`:
```python
def parse(self, token_filter: TokenFilter | None = None) -> SourceDocument:
    """Raises:
    EmptyTokensError: If parser produces zero tokens.
    Exception: If HTML parsing or token extraction fails.
    """
    try:
        soup = BeautifulSoup(self.content, "lxml")
        lines = self._extract_lines(soup, token_filter)
        self._validate_tokens_not_empty(lines)   # ← new
        metadata = self._build_metadata()
        self._log_metrics(lines)
        return SourceDocument(lines=lines, metadata=metadata)
    except Exception as e:
        logger.error("parse_failed", parser=self.parser_name, error=str(e), exc_info=True)
        raise
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Update FroalaParser edge-case tests that expect empty SourceDocument

**Files:**
- Modify: `tests/unit/processors/tokenizers/froala/test_froala_parser.py`

**Test cases:**
- ❌ Negative: `FroalaParser("", "utf-8").parse()` raises `EmptyTokensError` with `"FroalaParser"` in message (was: returned empty `SourceDocument`)
- ❌ Negative: `FroalaParser("<div>Just a div</div>", "utf-8").parse()` raises `EmptyTokensError` (was: returned empty `SourceDocument`)

**Test scaffold:**
```python
# Setup: no fixture needed
import pytest
from data_migrator.exceptions import EmptyTokensError
from data_migrator.processors.tokenizers.froala.froala_parser import FroalaParser


def test_empty_html_raises_empty_tokens_error():
    parser = FroalaParser("", "utf-8")
    with pytest.raises(EmptyTokensError, match="FroalaParser"):
        parser.parse()


def test_html_with_no_extractable_structure_raises_empty_tokens_error():
    parser = FroalaParser("<div>Just a div</div>", "utf-8")
    with pytest.raises(EmptyTokensError, match="FroalaParser"):
        parser.parse()
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/exceptions.py:DataMigratorError` — base class for `EmptyTokensError`
- `src/data_migrator/processors/tokenizers/base_parser.py:BaseTokenizerParser._log_metrics` — already computes token count with the same comprehension; the guard reuses the same pattern

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/document.py` — `SourceLine.tokens`, `SourceDocument`

**Patterns to follow:**
- structlog error call → raise domain exception (see `src/data_migrator/services/text_processing/validators.py:TokenTypeValidator.validate_include_types`)
- Private validation methods on service/parser classes (single-responsibility extraction)

**Test helpers to use:**
- Inline stub subclass pattern — no shared fixture needed for base-class unit tests

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/processors/tokenizers/test_base_parser.py tests/unit/processors/tokenizers/froala/test_froala_parser.py tests/unit/test_exceptions.py -v --cov=src/data_migrator/processors/tokenizers/base_parser --cov=src/data_migrator/exceptions
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

- Document with only whitespace-only text: whitespace tokens are pruned by `TextNormalizer` in `TokenPipeline._normalize_and_prune()` before reaching `_extract_lines`, so total count is zero → should raise
- Document with only PLACEHOLDER tokens (no TEXT tokens): `len(line.tokens) > 0`, so guard does NOT raise — placeholders are valid tokens
- SEA parser with empty input: covered automatically by the base class guard, no additional test needed

---

## Success Criteria

**Must have:**
- `EmptyTokensError` subclasses `DataMigratorError` and is importable from `data_migrator.exceptions`
- `BaseTokenizerParser.parse()` raises `EmptyTokensError` with parser name in the message when total token count across all lines is zero
- Existing `test_empty_html` and similar tests updated to expect `EmptyTokensError` instead of empty `SourceDocument`
- New unit tests for `BaseTokenizerParser._validate_tokens_not_empty()` covering all three paths (empty lines dict, lines with empty token lists, non-empty tokens)
- All tests pass
- Static analysis passes
- Coverage meets thresholds

**Nice to have:**
- Add `EmptyTokensError` to the public `__all__` export in `exceptions.py` if one is defined

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found in `docs/designs/`

**Memories Referenced:**
- None loaded (task is localized; code read directly)

**Similar Implementations:**
- `src/data_migrator/services/text_processing/validators.py:TokenTypeValidator.validate_include_types` — canonical example of structlog-then-raise validation pattern
- `src/data_migrator/processors/tokenizers/base_parser.py:BaseTokenizerParser._log_metrics` — uses the same token-count comprehension as the new guard
