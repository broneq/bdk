# Plan: Validate Empty Tokens Before Processing Starts

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Add a validator that checks if the parsed `SourceDocument` contains no tokens and raises a descriptive `EmptyTokensError` before downstream processing begins.
**Architecture:** Add `EmptyTokensError` to `exceptions.py`, then add a `_validate_non_empty()` static method to `SourceDocumentParser` that counts total tokens across all lines and raises with a descriptive message if the count is zero. The check runs immediately after `parser.parse()` returns in `parse_content()`.
**Complexity:** LOW

---

## Context

Both `FroalaParser` and `SeaContractsParser` implement `TokenizerInterface.parse()` and return a `SourceDocument` — a frozen Pydantic model with `lines: dict[int, SourceLine]` where each `SourceLine` holds `tokens: list[SourceToken]`. An empty document (no extractable structure, blank input, unrecognized HTML) currently passes silently through to `DocumentMigrationService.transform()`, which produces zero entries without indicating the cause.

The `SourceDocumentParser.parse_content()` method is the single entry point for all parser calls in the system — both `MigrateDocumentUseCase.execute()` and `ImportTemplateUseCase.execute()` route through it. This makes it the ideal place to add a fail-fast guard that catches empty-token documents before they waste downstream processing (transformation, verification, alignment).

No related design doc exists in `docs/designs/`. The `AlignmentValidator` class (`services/position_mapping/token_alignment/alignment_validator.py`) serves as a precedent for SRP validation static methods. The `exceptions.py` module centralises all custom exceptions in a flat hierarchy under `DataMigratorError`.

---

## Explored Approaches

### Approach 1: Static validator method in `SourceDocumentParser` (Selected)

**Description:** Add a `_validate_non_empty(doc, parser_name)` private static method to `SourceDocumentParser`. The method totals tokens across all lines of the `SourceDocument`; if zero, it logs and raises a new `EmptyTokensError`. Call it immediately after `parser.parse()` in `parse_content()`.

**Pros:**
- No new files — both the exception and the check are co-located with their natural owners
- Follows KISS; the check is three lines of logic, a full validator class would be over-engineering
- Central guard point: protects all callers (migrate, import, API) without touching individual parsers

**Cons:**
- Mixes validation concern into `SourceDocumentParser` — slight SRP tension, though private methods for internal guards are conventional in this codebase
- Does not guard the lower-level `parser.parse()` directly, so caller bypass is theoretically possible (but all callers go through `SourceDocumentParser`)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Modify: `src/data_migrator/exceptions.py`
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

---

### Approach 2: Dedicated `ParsedDocumentValidator` class (Not Selected)

**Description:** Create a new `ParsedDocumentValidator` class in `services/source_parsing/` with a `validate_non_empty(doc, parser_name)` static method, injected into or called by `SourceDocumentParser`.

**Pros / Cons:**
- Pros: Strict SRP; validator logic is independently testable and extendable.
- Cons: A full class + new file for a three-line check violates YAGNI and KISS. Adds injection complexity for negligible gain.

**Why not selected:** The validation is too simple to justify a separate class. The `AlignmentValidator` precedent is valid for complex monotonicity checks spanning multiple data structures; this check is a single aggregate count.

---

### Approach 3: Validation in `TokenizerInterface` base class (Not Selected)

**Description:** Add a `_validate_result(doc)` hook to `TokenizerInterface` that each parser calls after building the `SourceDocument`.

**Pros / Cons:**
- Pros: Validates at parse time, closest to the source.
- Cons: Touches both parsers, couples validation to the parser layer (wrong layer for business guard), and cannot be overridden by callers who might legitimately want empty documents in tests.

**Why not selected:** Architectural boundary violation — validation of parser output belongs in the service/use-case layer, not in the processor layer.

---

## Selected Approach: Static validator method in `SourceDocumentParser`

**Rationale:** Lowest complexity, zero new files, single guard point for all callers. The private static method pattern is established in this codebase (`_validate_newline_placement` in `TokenExtractor`, `_validate_table_tag` in `TableClassifier`). Adding `EmptyTokensError` to `exceptions.py` follows the existing pattern of domain-specific exceptions.

---

## Implementation Tasks

### Task 1: Add `EmptyTokensError` to exceptions module

**Files:**
- Modify: `src/data_migrator/exceptions.py`

**Test cases:**
- ✅ Positive: `EmptyTokensError` is importable from `data_migrator.exceptions`
- ✅ Positive: `EmptyTokensError` is a subclass of `DataMigratorError`

**Implementation:**

Add after `class ParserNotFoundError` (line 11) in `src/data_migrator/exceptions.py`:

```python
class EmptyTokensError(DataMigratorError):
    """Raised when a parsed document contains no tokens.

    Indicates that parsing produced a structurally valid but empty
    SourceDocument — typically caused by blank input, unrecognized HTML
    structure, or a parser that failed to match any content elements.
    """

    pass
```

**Commit message:** `feat: add EmptyTokensError for empty parsed document guard`

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Add `_validate_non_empty` static method and call it in `parse_content`

**Files:**
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Test: `tests/unit/services/source_parsing/test_source_document_parser.py`

**Test cases:**
- ✅ Positive: given a `SourceDocument` with one line containing one token, `parse_content()` returns the document without raising
- ✅ Positive: given a `SourceDocument` with multiple lines, all non-empty, returns successfully
- ❌ Negative: given a `SourceDocument` with no lines (`lines={}`), raises `EmptyTokensError` with message containing parser name
- ❌ Negative: given a `SourceDocument` with lines but all lines have `tokens=[]`, raises `EmptyTokensError`
- ❌ Negative: error message includes the parser name for actionable diagnostics

**Implementation:**

In `src/data_migrator/services/source_parsing/source_document_parser.py`, add the import and update `parse_content`:

```python
from data_migrator.exceptions import EmptyTokensError
```

Add this static method to `SourceDocumentParser`:

```python
@staticmethod
def _validate_non_empty(document: SourceDocument, parser_name: str) -> None:
    """Raise if parsed document contains no tokens.

    Raises:
        EmptyTokensError: If the total token count across all lines is zero.
    """
    total_tokens = sum(len(line.tokens) for line in document.lines.values())
    if total_tokens == 0:
        logger.error(
            "parsed_document_empty",
            parser=parser_name,
            line_count=len(document.lines),
        )
        raise EmptyTokensError(
            f"Parser '{parser_name}' produced a document with no tokens. "
            f"Found {len(document.lines)} line(s) but zero tokens total. "
            "Verify the input HTML contains recognizable content."
        )
```

Update `parse_content` to call the validator after `parser.parse()`:

```python
@timed
def parse_content(
    self,
    content: str,
    parser_name: str,
    encoding: str,
    token_filter: TokenFilter | None = None,
) -> SourceDocument:
    logger.debug("getting_parser", parser_name=parser_name)
    parser = self.tokenizer_strategy.get_parser(
        name=parser_name, content=content, encoding=encoding
    )

    logger.debug("executing_parser")
    document = parser.parse(token_filter=token_filter)
    self._validate_non_empty(document, parser_name)
    return document
```

**Test helper pattern** (follows existing `mock_parser` / `mock_strategy` fixtures in `test_source_document_parser.py`):

```python
def _make_empty_document() -> SourceDocument:
    """SourceDocument with lines but no tokens — triggers EmptyTokensError."""
    return SourceDocument(
        metadata=SourceDocumentMetadata(
            parser="test-parser",
            encoding="utf-8",
            timestamp="2024-01-01T00:00:00",
        ),
        lines={
            1: SourceLine(line_number=1, tokens=[]),
        },
    )

def _make_no_lines_document() -> SourceDocument:
    """SourceDocument with no lines at all — triggers EmptyTokensError."""
    return SourceDocument(
        metadata=SourceDocumentMetadata(
            parser="test-parser",
            encoding="utf-8",
            timestamp="2024-01-01T00:00:00",
        ),
        lines={},
    )
```

**Commit message:** `feat: validate non-empty tokens in SourceDocumentParser after parsing`

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Verify integration — empty HTML input raises through full stack

**Files:**
- Test: `tests/unit/services/source_parsing/test_source_document_parser.py`

**Test cases:**
- ✅ Integration: calling `parse_content()` with blank HTML (`"<html><body></body></html>"`) using the real `FroalaParser` raises `EmptyTokensError`
- ✅ Integration: calling `parse_content()` with blank HTML using the real `SeaContractsParser` raises `EmptyTokensError`

**Implementation:**

These are integration-level unit tests that use the real parsers (no mocks) to confirm the end-to-end guard. Add to `test_source_document_parser.py`:

```python
from data_migrator.exceptions import EmptyTokensError
from data_migrator.processors.tokenizer_strategy import TokenizerStrategy


@pytest.fixture
def real_strategy() -> TokenizerStrategy:
    return TokenizerStrategy.create_default()


@pytest.fixture
def real_parser_service(real_strategy: TokenizerStrategy) -> SourceDocumentParser:
    return SourceDocumentParser(tokenizer_strategy=real_strategy)


BLANK_HTML = "<html><body></body></html>"


def test_parse_content_raises_on_blank_froala_html(
    real_parser_service: SourceDocumentParser,
) -> None:
    with pytest.raises(EmptyTokensError, match="froala"):
        real_parser_service.parse_content(
            content=BLANK_HTML,
            parser_name="froala",
            encoding="utf-8",
        )


def test_parse_content_raises_on_blank_sea_html(
    real_parser_service: SourceDocumentParser,
) -> None:
    with pytest.raises(EmptyTokensError, match="sea-contracts"):
        real_parser_service.parse_content(
            content=BLANK_HTML,
            parser_name="sea-contracts",
            encoding="utf-8",
        )
```

**Commit message:** `test: add integration tests for empty-token guard in SourceDocumentParser`

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/services/source_parsing/source_document_parser.py:SourceDocumentParser` — site of the change; already has `@timed` decorator and structlog logger
- `src/data_migrator/exceptions.py:DataMigratorError` — base class for the new exception

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/document.py` — defines `SourceDocument`, `SourceLine`; `SourceLine.tokens` is `list[SourceToken]`

**Patterns to follow:**
- Exception hierarchy: `class EmptyTokensError(DataMigratorError): pass` (same as `ParserNotFoundError`, `XmlParseError`, etc.)
- Private static validators: `_validate_newline_placement` in `TokenExtractor`, `_validate_table_tag` in `TableClassifier`
- structlog before raise: `logger.error("event_name", key=value)` then `raise ExcType("message")`

**Test helpers to use:**
- Existing `mock_strategy` / `mock_parser` fixtures in `tests/unit/services/source_parsing/test_source_document_parser.py`
- `SourceDocumentMetadata`, `SourceLine`, `SourceToken` from `schemas/models`

---

## Verification

### Code Quality

Delegate to `static-analysis` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/services/source_parsing/test_source_document_parser.py -v
Coverage targets:
  - Critical paths: >90%
  - Business logic: >85%
```

### Edge Cases to Test

- `SourceDocument` with zero lines (`lines={}`) — should raise
- `SourceDocument` with multiple lines all having `tokens=[]` — should raise
- `SourceDocument` with at least one token in any line — should NOT raise
- Error message must contain the parser name string

---

## Success Criteria

**Must have:**
- `EmptyTokensError` importable from `data_migrator.exceptions`, subclasses `DataMigratorError`
- `SourceDocumentParser.parse_content()` raises `EmptyTokensError` with descriptive message when token count is zero
- Error message includes `parser_name` for actionable diagnostics
- All existing tests continue to pass (non-breaking change for non-empty documents)
- Static analysis passes (ruff + mypy strict + radon)
- New tests pass and cover both unit (mock) and integration (real parsers) scenarios

**Nice to have:**
- Log event `parsed_document_empty` at ERROR level before raising (already included in implementation above)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None

**Memories Referenced:**
- `utility_classes` — confirmed no existing empty-token validator; `AlignmentValidator` pattern reviewed as precedent for SRP static validators

**Similar Implementations:**
- `src/data_migrator/services/position_mapping/token_alignment/alignment_validator.py:AlignmentValidator` — precedent for a focused SRP validation static method
- `src/data_migrator/processors/tokenizers/froala/core/token_extractor.py:TokenExtractor/_validate_newline_placement` — precedent for private static validators on processing classes
