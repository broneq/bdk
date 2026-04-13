# Plan: Validate Empty Tokens Before Processing

**Date:** 2026-03-24
**Slug:** validate-empty-tokens-before-processing
**Approach:** Validate in SourceDocumentParser via dedicated SourceDocumentValidator class
**Complexity:** LOW
**Risk:** LOW

---

## Context

After HTML parsing via `FroalaParser` or `SeaContractsParser`, the resulting `SourceDocument.lines`
can silently be `{}` (empty dict) when the parser finds no extractable structure — e.g., on malformed
input, wrong format, or truly empty content. This empty document propagates downstream into
`DocumentMigrationService.transform()` where it silently produces zero migration entries, giving the
caller no feedback that parsing yielded nothing useful.

The fix: add a dedicated `SourceDocumentValidator` class at the `SourceDocumentParser` boundary that
raises a new `EmptySourceDocumentError` when `document.lines` is empty, before the document enters
further processing.

---

## Affected Files

### Files to Modify
- `src/data_migrator/exceptions.py` — add `EmptySourceDocumentError`
- `src/data_migrator/services/source_parsing/source_document_parser.py` — wire in validator

### Files to Create
- `src/data_migrator/services/source_parsing/source_document_validator.py` — new validator class
- `tests/unit/services/source_parsing/test_source_document_validator.py` — validator unit tests

---

## Exploration Findings

- **Existing implementations:** `TokenTypeValidator` in `services/text_processing/validators.py` — stateless
  class, `@staticmethod` methods, structlog error before raise (direct pattern to follow)
- **Reusable utilities:** `structlog.get_logger(__name__)`, `DataMigratorError` hierarchy in `exceptions.py`
- **Relevant models:** `SourceDocument` (lines: `dict[int, SourceLine]`), `SourceDocumentMetadata.parser`
- **Patterns:** Custom exception subclassing `DataMigratorError`, structlog error log before raise,
  validator as separate class (SRP), `from __future__ import annotations` on all model-touching files
- **Affected layers:** Service Layer (`source_parsing/`), Exceptions module
- **Test patterns:** `pytest.raises(ExceptionType, match="...")` with parser name assertion; `Mock(spec=...)` fixtures
- **SOLID:** SRP (validator separate from parser), OCP (parser not changed structurally, validator added), DIP (parser uses validator, both depend on `SourceDocument` abstraction)

---

## Approaches Considered

### A — Dedicated SourceDocumentValidator class in SourceDocumentParser ✅ RECOMMENDED
- **Pattern:** Service Layer guard + SRP validator class (follows `TokenTypeValidator` pattern)
- **Pros:** Single validation point for all parsers; parser stays focused on orchestration; validator independently testable; extensible (can add more checks later without touching parser)
- **Cons:** One new file (minimal cost)
- **Complexity:** LOW | **Risk:** LOW
- **Files:** `exceptions.py`, `source_document_validator.py` (new), `source_document_parser.py`

### B — Private static method on SourceDocumentParser
- **Pattern:** Inline guard on parser class
- **Pros:** No new file; check co-located with usage
- **Cons:** Slight SRP violation; mixes validation concern into orchestration class; harder to test the check in isolation; each new check must be added to parser
- **Complexity:** LOW | **Risk:** LOW
- **Why rejected:** Violates SRP; `TokenTypeValidator` precedent shows validators belong in their own class

### C — Validate in each parser's parse() method (FroalaParser, SeaContractsParser)
- **Pattern:** Parser-level guard in each concrete parser
- **Pros:** Validation close to production point
- **Cons:** Code duplication; every new parser must remember to add check; violates DRY; wrong layer (validation of output belongs in service layer, not processor layer)
- **Complexity:** LOW | **Risk:** MEDIUM
- **Why rejected:** Architectural boundary violation + DRY violation

---

## Implementation Tasks

### Task 1: Add EmptySourceDocumentError to exceptions.py

**TDD cycle:** Write test → verify fails → implement → verify passes → commit

**Test** (add to `tests/unit/test_exceptions.py` or a standalone test):
```python
from data_migrator.exceptions import DataMigratorError, EmptySourceDocumentError


def test_empty_source_document_error_is_data_migrator_error() -> None:
    err = EmptySourceDocumentError("FroalaParser produced 0 lines")
    assert isinstance(err, DataMigratorError)


def test_empty_source_document_error_message_preserved() -> None:
    err = EmptySourceDocumentError("FroalaParser produced 0 lines")
    assert "FroalaParser" in str(err)
```

**Implementation** — add to `src/data_migrator/exceptions.py` after `class ParserNotFoundError`:
```python
class EmptySourceDocumentError(DataMigratorError):
    """Raised when parsed source document contains no lines (empty tokens list).

    Indicates that parsing produced a structurally valid but empty SourceDocument —
    typically caused by blank input, unrecognized HTML structure, or a parser that
    failed to match any content elements.
    """

    pass
```

**Verify:**
```
pytest tests/unit/test_exceptions.py -v
```

**Commit:**
```
feat: add EmptySourceDocumentError for empty parsed document guard
```

---

### Task 2: Create SourceDocumentValidator

**TDD cycle:** Create test file → write failing tests → implement validator → verify passes → commit

**Test file:** `tests/unit/services/source_parsing/test_source_document_validator.py`

```python
"""Unit tests for SourceDocumentValidator."""

from __future__ import annotations

import pytest

from data_migrator.exceptions import EmptySourceDocumentError
from data_migrator.schemas.models.document import SourceDocument, SourceDocumentMetadata, SourceLine
from data_migrator.schemas.models.token import ChangeType, SourceToken, TokenType
from data_migrator.services.source_parsing.source_document_validator import (
    SourceDocumentValidator,
)


def _make_metadata(parser: str = "FroalaParser") -> SourceDocumentMetadata:
    return SourceDocumentMetadata(parser=parser, encoding="utf-8", timestamp="2026-01-01T00:00:00")


def _make_empty_document(parser: str = "FroalaParser") -> SourceDocument:
    return SourceDocument(lines={}, metadata=_make_metadata(parser))


def _make_document_with_lines(parser: str = "FroalaParser") -> SourceDocument:
    token = SourceToken(type=TokenType.TEXT, text_type=ChangeType.BLACK, value="hello")
    line = SourceLine(line_number=1, tokens=[token])
    return SourceDocument(lines={1: line}, metadata=_make_metadata(parser))


class TestSourceDocumentValidatorRaisesOnEmpty:
    def test_raises_for_empty_lines_dict(self) -> None:
        doc = _make_empty_document("FroalaParser")
        with pytest.raises(EmptySourceDocumentError):
            SourceDocumentValidator.validate(doc)

    def test_error_message_contains_parser_name_froala(self) -> None:
        doc = _make_empty_document("FroalaParser")
        with pytest.raises(EmptySourceDocumentError, match="FroalaParser"):
            SourceDocumentValidator.validate(doc)

    def test_error_message_contains_parser_name_sea(self) -> None:
        doc = _make_empty_document("SeaContractsParser")
        with pytest.raises(EmptySourceDocumentError, match="SeaContractsParser"):
            SourceDocumentValidator.validate(doc)

    def test_error_message_contains_zero_lines(self) -> None:
        doc = _make_empty_document("FroalaParser")
        with pytest.raises(EmptySourceDocumentError, match="0 lines"):
            SourceDocumentValidator.validate(doc)


class TestSourceDocumentValidatorPassesOnNonEmpty:
    def test_does_not_raise_for_document_with_one_line(self) -> None:
        doc = _make_document_with_lines("FroalaParser")
        SourceDocumentValidator.validate(doc)  # Should not raise

    def test_does_not_raise_for_sea_parser_document(self) -> None:
        doc = _make_document_with_lines("SeaContractsParser")
        SourceDocumentValidator.validate(doc)  # Should not raise
```

**Implementation** — `src/data_migrator/services/source_parsing/source_document_validator.py`:
```python
"""Validator for SourceDocument post-parse integrity checks."""

from __future__ import annotations

import structlog

from data_migrator.exceptions import EmptySourceDocumentError
from data_migrator.schemas.models.document import SourceDocument

logger = structlog.get_logger(__name__)


class SourceDocumentValidator:
    """Validates SourceDocument integrity after parsing.

    Checks that parsing produced at least one line of extractable content.
    Follows the same stateless-class pattern as TokenTypeValidator.
    """

    @staticmethod
    def validate(document: SourceDocument) -> None:
        """Validate that document contains at least one line.

        Raises:
            EmptySourceDocumentError: If document.lines is empty.
        """
        if not document.lines:
            parser_name = document.metadata.parser
            logger.error(
                "empty_source_document",
                parser=parser_name,
                line_count=0,
            )
            raise EmptySourceDocumentError(
                f"Parser '{parser_name}' produced 0 lines — document may be empty, "
                "malformed, or in an unsupported format."
            )
```

**Verify:**
```
pytest tests/unit/services/source_parsing/test_source_document_validator.py -v
```

**Commit:**
```
feat: add SourceDocumentValidator to detect empty parsed documents
```

---

### Task 3: Wire SourceDocumentValidator into SourceDocumentParser

**TDD cycle:** Write failing tests in existing test file → update implementation → verify passes → commit

**Tests** — add new test class to `tests/unit/services/source_parsing/test_source_document_parser.py`:

```python
from pathlib import Path
from unittest.mock import Mock

import pytest

from data_migrator.exceptions import EmptySourceDocumentError
from data_migrator.schemas.models.document import SourceDocument, SourceDocumentMetadata
from data_migrator.services.source_parsing.source_document_parser import SourceDocumentParser


def _make_empty_doc() -> SourceDocument:
    return SourceDocument(
        lines={},
        metadata=SourceDocumentMetadata(
            parser="FroalaParser", encoding="utf-8", timestamp="2026-01-01T00:00:00"
        ),
    )


class TestSourceDocumentParserValidation:
    def test_parse_content_raises_when_parser_returns_empty_document(
        self, mock_strategy: Mock
    ) -> None:
        mock_parser = Mock()
        mock_parser.parse.return_value = _make_empty_doc()
        mock_strategy.get_parser.return_value = mock_parser

        parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)
        with pytest.raises(EmptySourceDocumentError, match="FroalaParser"):
            parser.parse_content(
                content="<html></html>",
                parser_name="froala",
                encoding="utf-8",
            )

    def test_parse_file_raises_when_parser_returns_empty_document(
        self, mock_strategy: Mock, tmp_path: Path
    ) -> None:
        empty_file = tmp_path / "empty.html"
        empty_file.write_text("", encoding="utf-8")

        mock_parser = Mock()
        mock_parser.parse.return_value = _make_empty_doc()
        mock_strategy.get_parser.return_value = mock_parser

        parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)
        with pytest.raises(EmptySourceDocumentError, match="FroalaParser"):
            parser.parse_file(
                file_path=empty_file,
                parser_name="froala",
                encoding="utf-8",
            )
```

**Implementation** — update `src/data_migrator/services/source_parsing/source_document_parser.py`:

```python
from pathlib import Path

import structlog

from data_migrator.processors import TokenizerStrategy
from data_migrator.schemas.models import SourceDocument, TokenFilter
from data_migrator.services.source_parsing.source_document_validator import (
    SourceDocumentValidator,
)
from data_migrator.utils.timing import timed

logger = structlog.get_logger(__name__)


class SourceDocumentParser:
    def __init__(
        self,
        tokenizer_strategy: TokenizerStrategy | None = None,
    ) -> None:
        self.tokenizer_strategy = tokenizer_strategy or TokenizerStrategy.create_default()

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
        SourceDocumentValidator.validate(document)
        return document

    def parse_file(
        self,
        file_path: Path,
        parser_name: str,
        encoding: str,
        token_filter: TokenFilter | None = None,
    ) -> SourceDocument:
        logger.debug("reading_file", file_path=str(file_path), encoding=encoding)
        source_content = file_path.read_text(encoding=encoding)
        return self.parse_content(
            content=source_content,
            parser_name=parser_name,
            encoding=encoding,
            token_filter=token_filter,
        )
```

**Verify:**
```
pytest tests/unit/services/source_parsing/ -v --cov=src/data_migrator/services/source_parsing
```

**Commit:**
```
feat: wire SourceDocumentValidator into SourceDocumentParser.parse_content
```

---

### Task 4: Update existing empty-file test to expect EmptySourceDocumentError

The existing test `test_parse_empty_file` in `TestSourceDocumentParserIntegration` currently asserts
`len(result.lines) == 0`. This now needs to assert `EmptySourceDocumentError` is raised instead.

**Find in** `tests/unit/services/source_parsing/test_source_document_parser.py`:
```python
def test_parse_empty_file(
    self,
    mock_strategy: Mock,
    mock_parser: Mock,
    tmp_path: Path,
) -> None:
    """Test parsing empty file."""
    ...
    assert isinstance(result, SourceDocument)
    assert len(result.lines) == 0
```

**Replace with:**
```python
def test_parse_empty_file_raises_empty_source_document_error(
    self,
    mock_strategy: Mock,
    tmp_path: Path,
) -> None:
    """Test parsing file that produces no lines raises EmptySourceDocumentError."""
    from data_migrator.exceptions import EmptySourceDocumentError

    empty_file = tmp_path / "empty.html"
    empty_file.write_text("", encoding="utf-8")

    mock_parser = Mock()
    mock_parser.parse.return_value = SourceDocument(
        metadata=SourceDocumentMetadata(
            parser="test-parser",
            encoding="utf-8",
            timestamp="2024-01-01T00:00:00",
        ),
        lines={},
    )
    mock_strategy.get_parser.return_value = mock_parser

    parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)
    with pytest.raises(EmptySourceDocumentError, match="test-parser"):
        parser.parse_file(
            file_path=empty_file,
            parser_name="froala",
            encoding="utf-8",
        )
```

**Verify:**
```
pytest tests/unit/services/source_parsing/ -v
```

**Commit:**
```
test: update empty file test to expect EmptySourceDocumentError
```

---

## Verification

### Tests
Delegate to `test-runner` subagent:
```
pytest tests/unit/services/source_parsing/ tests/unit/test_exceptions.py -v --cov=src/data_migrator/services/source_parsing --cov=src/data_migrator/exceptions
```

### Code Quality
Delegate to `static-analysis` subagent:
```
bin/cleanup.sh
```

---

## Success Criteria

- [ ] `EmptySourceDocumentError` exists in `exceptions.py`, inherits from `DataMigratorError`
- [ ] `SourceDocumentValidator.validate()` raises `EmptySourceDocumentError` with parser name and "0 lines" in message
- [ ] `SourceDocumentParser.parse_content()` calls `SourceDocumentValidator.validate()` after `parser.parse()`
- [ ] `parse_file()` inherits validation via `parse_content()` (no duplication)
- [ ] All new tests pass; existing `test_parse_empty_file` updated for new behavior
- [ ] `bin/cleanup.sh` passes (MI >= A, CC <= B, ruff clean, mypy strict)
