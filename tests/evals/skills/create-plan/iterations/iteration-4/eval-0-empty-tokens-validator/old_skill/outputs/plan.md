# Plan: Validate Empty Tokens Before Processing Starts

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Add a validator that checks if the parsed `SourceDocument` contains no tokens and raises a descriptive `EmptyTokensError` before downstream processing begins.
**Architecture:** Add `EmptyTokensError` to `exceptions.py`, then add a `_validate_non_empty()` private static method to `SourceDocumentParser` that counts total tokens across all lines and raises with a descriptive message if the count is zero. The check runs immediately after `parser.parse()` returns in `parse_content()`.
**Complexity:** LOW

---

## Context

Both `FroalaParser` and `SeaContractsParser` implement `TokenizerInterface.parse()` and return a `SourceDocument` — a frozen Pydantic model with `lines: dict[int, SourceLine]` where each `SourceLine` holds `tokens: list[SourceToken]`. An empty document (no extractable structure, blank input, unrecognized HTML) currently passes silently through to `DocumentMigrationService.transform()`, which produces zero entries without indicating the cause.

The `SourceDocumentParser.parse_content()` method is the single entry point for all parser calls in the system. Both `MigrateDocumentUseCase.execute()` and `ImportTemplateUseCase.execute()` route through it. This makes it the ideal place to add a fail-fast guard that catches empty-token documents before they waste downstream processing (transformation, verification, alignment).

No related design doc exists in `docs/designs/`. The existing `exceptions.py` module centralises all custom exceptions in a flat hierarchy under `DataMigratorError`. `EmptyTokensError` does not yet exist — `ParserNotFoundError` serves as the closest structural precedent.

**Important:** The existing test `TestSourceDocumentParserIntegration::test_parse_empty_file` currently asserts `len(result.lines) == 0` on a mock that returns an empty `SourceDocument`. After adding the validator, that test must be updated to expect `EmptyTokensError` instead — or the mock must return a non-empty document.

---

## Explored Approaches

### Approach 1: Static `_validate_non_empty` method on `SourceDocumentParser` (Selected)

**Description:** Add a private static method `_validate_non_empty(doc, parser_name)` to `SourceDocumentParser`. It totals tokens across all lines; if zero, it logs and raises `EmptyTokensError`. Called immediately after `parser.parse()` in `parse_content()`.

**Pros:**
- Single guard point — protects all callers (migrate, import, API) without touching individual parsers
- Follows established codebase pattern: private static validators on processing classes (`_validate_newline_placement` in `TokenExtractor`, `_validate_table_tag` in `TableClassifier`)
- Zero new files — exception and check co-located with their natural owners

**Cons:**
- Slight SRP tension: validation concern added to `SourceDocumentParser` — acceptable given the private static method convention for internal guards in this codebase

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Modify: `src/data_migrator/exceptions.py`
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

---

### Approach 2: Separate `ParsedDocumentValidator` Class (Not Selected)

**Description:** Create a new `ParsedDocumentValidator` class in `services/source_parsing/` with a `validate_non_empty(doc, parser_name)` static method, called by `SourceDocumentParser`.

**Pros / Cons:**
- Pros: Strict SRP; independently testable; extendable for future validation rules.
- Cons: A full class and new file for a three-line check violates YAGNI and KISS. Adds unnecessary abstraction.

**Why not selected:** The validation is too simple to justify a separate class. Over-engineering for negligible gain — the `_validate_non_empty` private static follows existing codebase convention.

---

### Approach 3: Validation Inside Each Parser (Not Selected)

**Description:** Add a guard clause inside `FroalaParser.parse()` and `SeaContractsParser.parse()` to raise `EmptyTokensError` before returning.

**Pros / Cons:**
- Pros: Validates at the earliest possible point.
- Cons: Duplicated logic across every parser — each new parser must remember to add it. Violates DRY. Architectural boundary violation: validation of parser output belongs in the service layer, not the processor layer.

**Why not selected:** Wrong architectural layer and duplicated logic. Centralised guard in `SourceDocumentParser` is strictly superior.

---

## Selected Approach: Static validator method in `SourceDocumentParser`

**Rationale:** Lowest complexity, zero new files, single guard point for all callers. The private static method pattern is established in this codebase. Adding `EmptyTokensError` to `exceptions.py` follows the existing flat-hierarchy pattern under `DataMigratorError`.

---

## Implementation Tasks

### Task 1: Add `EmptyTokensError` to exceptions module

**Files:**
- Modify: `src/data_migrator/exceptions.py`

**Test cases:**
- ✅ Positive: `EmptyTokensError` is importable from `data_migrator.exceptions`
- ✅ Positive: `isinstance(EmptyTokensError("msg"), DataMigratorError)` returns `True`
- ✅ Positive: `isinstance(EmptyTokensError("msg"), Exception)` returns `True`

**Implementation:**

Insert after `class ParserNotFoundError` (line 9) in `src/data_migrator/exceptions.py`:

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

### Task 2: Add `_validate_non_empty` and call it in `parse_content`

**Files:**
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

**Test cases:**
- ✅ Positive: given `mock_parser.parse.return_value` is a `SourceDocument` with 1 line containing 1 `SourceToken`, `parse_content()` returns the document without raising
- ✅ Positive: given a `SourceDocument` with 3 lines each having 2 tokens, `parse_content()` returns successfully
- ❌ Negative: given `mock_parser.parse.return_value` is `SourceDocument(lines={})`, `parse_content()` raises `EmptyTokensError` with `"test-parser"` in the message
- ❌ Negative: given `SourceDocument` with 2 lines both having `tokens=[]`, `parse_content()` raises `EmptyTokensError`
- ❌ Negative: error message contains `"Lines found: 2"` when 2 lines with no tokens are present

**Implementation:**

Add import at top of `src/data_migrator/services/source_parsing/source_document_parser.py`:

```python
from data_migrator.exceptions import EmptyTokensError
```

Add private static method to `SourceDocumentParser`:

```python
@staticmethod
def _validate_non_empty(document: SourceDocument, parser_name: str) -> None:
    """Raise if parsed document contains no tokens.

    Raises:
        EmptyTokensError: If total token count across all lines is zero.
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
            f"Lines found: {len(document.lines)}. "
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

**Existing test update required:**

`TestSourceDocumentParserIntegration::test_parse_empty_file` currently asserts `len(result.lines) == 0`. After this change, `parse_content()` raises `EmptyTokensError` before returning. Update the test:

```python
def test_parse_empty_file(
    self,
    mock_strategy: Mock,
    mock_parser: Mock,
    tmp_path: Path,
) -> None:
    """Test parsing empty file raises EmptyTokensError."""
    empty_file = tmp_path / "empty.html"
    empty_file.write_text("", encoding="utf-8")

    mock_strategy.get_parser.return_value = mock_parser
    mock_parser.parse.return_value = SourceDocument(
        metadata=SourceDocumentMetadata(
            parser="test-parser",
            encoding="utf-8",
            timestamp="2024-01-01T00:00:00",
        ),
        lines={},
    )

    parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)

    with pytest.raises(EmptyTokensError, match="test-parser"):
        parser.parse_file(
            file_path=empty_file,
            parser_name="test-parser",
            encoding="utf-8",
        )
```

**Commit message:** `feat: validate non-empty tokens in SourceDocumentParser after parsing`

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Add error message content tests

**Files:**
- Modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

**Test cases:**
- ✅ Positive: error message for `lines={}` contains `"Lines found: 0"`
- ✅ Positive: error message for 3 lines with `tokens=[]` each contains `"Lines found: 3"`
- ✅ Positive: error message always contains the `parser_name` string passed to `parse_content()`

**Implementation:**

Add a focused test class for the validator's message content:

```python
class TestSourceDocumentParserValidation:
    """Test empty-token validation in SourceDocumentParser."""

    def _make_document(self, lines: dict) -> SourceDocument:
        return SourceDocument(
            metadata=SourceDocumentMetadata(
                parser="test-parser",
                encoding="utf-8",
                timestamp="2024-01-01T00:00:00",
            ),
            lines=lines,
        )

    def test_raises_with_parser_name_in_message(
        self, mock_strategy: Mock, mock_parser: Mock
    ) -> None:
        mock_strategy.get_parser.return_value = mock_parser
        mock_parser.parse.return_value = self._make_document(lines={})
        parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)

        with pytest.raises(EmptyTokensError, match="froala"):
            parser.parse_content(
                content="<html></html>",
                parser_name="froala",
                encoding="utf-8",
            )

    def test_raises_with_zero_lines_count_in_message(
        self, mock_strategy: Mock, mock_parser: Mock
    ) -> None:
        mock_strategy.get_parser.return_value = mock_parser
        mock_parser.parse.return_value = self._make_document(lines={})
        parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)

        with pytest.raises(EmptyTokensError, match="Lines found: 0"):
            parser.parse_content(
                content="<html></html>",
                parser_name="froala",
                encoding="utf-8",
            )

    def test_raises_with_line_count_when_tokens_empty(
        self, mock_strategy: Mock, mock_parser: Mock
    ) -> None:
        lines = {
            1: SourceLine(line_number=1, tokens=[]),
            2: SourceLine(line_number=2, tokens=[]),
            3: SourceLine(line_number=3, tokens=[]),
        }
        mock_strategy.get_parser.return_value = mock_parser
        mock_parser.parse.return_value = self._make_document(lines=lines)
        parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)

        with pytest.raises(EmptyTokensError, match="Lines found: 3"):
            parser.parse_content(
                content="<html></html>",
                parser_name="froala",
                encoding="utf-8",
            )
```

**Commit message:** `test: verify EmptyTokensError message content from SourceDocumentParser`

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/services/source_parsing/source_document_parser.py:SourceDocumentParser` — site of the change; already has `@timed` decorator and structlog `logger`
- `src/data_migrator/exceptions.py:DataMigratorError` — base class for the new exception

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/document.py` — defines `SourceDocument`, `SourceLine`; `SourceLine.tokens` is `list[SourceToken]`

**Patterns to follow:**
- Exception hierarchy: `class EmptyTokensError(DataMigratorError): pass` — same as `ParserNotFoundError`
- Private static validators: `_validate_newline_placement` in `TokenExtractor`, `_validate_table_tag` in `TableClassifier`
- structlog before raise: `logger.error("event_name", key=value)` then `raise ExcType("message")`

**Test helpers to use:**
- `tests/unit/services/source_parsing/test_source_document_parser.py:mock_strategy` fixture — returns a `Mock` for `TokenizerStrategy`
- `tests/unit/services/source_parsing/test_source_document_parser.py:mock_parser` fixture — returns a `Mock` with a pre-built non-empty `SourceDocument`
- `SourceDocumentMetadata`, `SourceLine`, `SourceToken` from `schemas/models/document.py` for building test documents

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/services/source_parsing/test_source_document_parser.py -v --cov=src/data_migrator/services/source_parsing
Coverage targets:
  - Critical paths: >90%
  - Business logic: >85%
```

### Code Quality

Delegate to `static-analysis` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Edge Cases to Test

- `SourceDocument` with zero lines (`lines={}`) — must raise `EmptyTokensError`
- `SourceDocument` with 3 lines all having `tokens=[]` — must raise `EmptyTokensError`
- `SourceDocument` with at least one token in any line — must NOT raise
- Error message must contain the `parser_name` string for actionable diagnostics
- Error message must include `"Lines found: N"` with correct count
- `parse_file()` inherits the same behaviour through delegation to `parse_content()` — no extra changes needed

---

## Success Criteria

**Must have:**
- `EmptyTokensError` importable from `data_migrator.exceptions`, subclasses `DataMigratorError`
- `SourceDocumentParser.parse_content()` raises `EmptyTokensError` with descriptive message when token count is zero
- Error message includes `parser_name` and line count for actionable diagnostics
- `parse_file()` inherits validation automatically (no changes needed — delegates to `parse_content()`)
- `TestSourceDocumentParserIntegration::test_parse_empty_file` updated to expect `EmptyTokensError`
- All existing passing tests continue to pass (non-breaking for non-empty documents)
- Static analysis passes (ruff + mypy strict + radon MI >= A, CC <= B)
- New tests cover: zero lines, lines with empty tokens, non-empty passes through, message content

**Nice to have:**
- structlog event `parsed_document_empty` at `error` level before raising (included in implementation above)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None

**Memories Referenced:**
- `utility_classes` — confirmed no existing empty-token validator; `AlignmentValidator` reviewed as precedent for focused SRP validation static methods

**Similar Implementations:**
- `src/data_migrator/processors/tokenizers/froala/core/token_extractor.py:TokenExtractor/_validate_newline_placement` — precedent for private static validators on processing classes
- `src/data_migrator/exceptions.py:ParserNotFoundError` — structural template for the new `EmptyTokensError`
