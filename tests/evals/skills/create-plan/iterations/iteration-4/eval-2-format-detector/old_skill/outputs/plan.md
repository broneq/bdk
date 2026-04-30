# Plan: Document Format Detector with Auto-Parser Selection

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Implement `SeaContractsFormatDetector`, extend `DocumentFormat` enum with `SEA_HTML`, register the detector in `FormatDetectorStrategy.create_default()`, add a `TokenizerStrategy.format_to_parser_name()` bridge, and expose `SourceDocumentParser.detect_and_parse()` so callers can auto-select the right parser from raw HTML.
**Architecture:** New `SeaContractsFormatDetector` under `detectors/sea/` mirrors `FroalaFormatDetector` exactly. `DocumentFormat` gains `SEA_HTML`. A static `format_to_parser_name()` on `TokenizerStrategy` closes the format→parser-name gap without coupling layers. `SourceDocumentParser.detect_and_parse()` orchestrates detect → bridge → parse in one call.
**Complexity:** LOW

---

## Context

The codebase already has a complete format-detection infrastructure:

- `src/data_migrator/detectors/base.py:FormatDetectorInterface` — ABC all detectors implement
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — existing implementation and structural template
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — strategy registry; `create_default()` currently only registers Froala
- `src/data_migrator/schemas/models/fingerprint.py:DocumentFormat` — StrEnum with `FROALA_HTML` and `UNKNOWN`; missing `SEA_HTML`
- `src/data_migrator/processors/tokenizer_strategy.py:TokenizerStrategy` — registers `froala` and `sea_contracts` parsers; no format→name bridge
- `src/data_migrator/services/source_parsing/source_document_parser.py:SourceDocumentParser` — `parse_content()` / `parse_file()` require an explicit `parser_name`

Two gaps exist: (1) No `SeaContractsFormatDetector` — any SEA Contracts HTML that arrives causes `FormatDetectionError` in the strategy. (2) No bridge between `DocumentFormat` values and `TokenizerStrategy` parser name strings — a caller who calls `FormatDetectorStrategy.detect(content)` gets a `DocumentFormat` back but cannot translate it to the `parser_name` string required by `TokenizerStrategy.get_parser()`.

SEA Contracts HTML is identified by ICE track-change markers: `ice-ins` (tracked insertions) and `ice-del` (tracked deletions), which are unique to the CKEditor + ICE/CPM toolchain. The `SeaContractsParser` is already registered as `"sea_contracts"` in `TokenizerStrategy.create_default()`.

---

## Explored Approaches

### Approach 1: SeaDetector + Static Bridge in TokenizerStrategy (Selected)

**Description:** Add `SeaContractsFormatDetector` following the exact same pattern as `FroalaFormatDetector` (fast string-scan, no BeautifulSoup). Add `SEA_HTML` to `DocumentFormat`. Register the detector in `FormatDetectorStrategy.create_default()`. Add a static `format_to_parser_name()` method on `TokenizerStrategy` using a `_FORMAT_TO_PARSER` dict keyed on format value strings (avoids a module-level `DocumentFormat` import in the processors layer). Add `SourceDocumentParser.detect_and_parse()` that calls detect → bridge → parse_content.

**Pros:**
- Follows all existing patterns exactly — mirrors `FroalaFormatDetector` with ~30 lines of new code
- Minimal surface area: two new files, four small modifications
- SRP preserved — each class retains single responsibility; no existing contracts changed

**Cons:**
- `_FORMAT_TO_PARSER` must be updated manually each time a new parser+detector pair is added; risk of drift if discipline lapses

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Create: `src/data_migrator/detectors/sea/__init__.py`
- Create: `src/data_migrator/detectors/sea/sea_contracts_format_detector.py`
- Modify: `src/data_migrator/schemas/models/fingerprint.py`
- Modify: `src/data_migrator/detectors/format_detector_strategy.py`
- Modify: `src/data_migrator/processors/tokenizer_strategy.py`
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Create: `tests/unit/detectors/sea/__init__.py`
- Create: `tests/unit/detectors/sea/test_sea_contracts_format_detector.py`
- Modify: `tests/unit/detectors/test_format_detector_strategy.py`
- Modify: `tests/unit/processors/test_tokenizer_strategy.py`
- Modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

---

### Approach 2: FormatAwareParserSelector New Service (Not Selected)

**Description:** A new service class composing `FormatDetectorStrategy` and `TokenizerStrategy`, exposing `select_and_parse(content)` as a single entry point.

**Pros / Cons:** Clean single entry-point, easy to test; but adds an unnecessary class, grows DI container surface, complicates the import graph, and adds no real value beyond a 3-line operation.

**Why not selected:** Over-engineering. Adds a god-object risk, violates YAGNI/KISS. The static bridge in `TokenizerStrategy` is sufficient and follows existing patterns.

---

### Approach 3: Auto-detect Flag on CLI Commands (Not Selected)

**Description:** Add `--auto-detect` flag to `import-template` and `migrate` CLI commands, resolving parser from document content before forwarding to use cases.

**Pros / Cons:** Nice caller UX; but parser selection is a domain concern, not a presentation concern. Moving it to the CLI violates layer separation and duplicates logic.

**Why not selected:** Layer violation. Business logic belongs in services/use cases, not CLI handlers.

---

## Selected Approach: SeaDetector + Static Bridge in TokenizerStrategy

**Rationale:** Lowest complexity, perfectly mirrors existing patterns, no layer violations, and no new classes beyond the required detector. The static `format_to_parser_name()` method is the minimal correct bridge between detection and parsing without coupling the processor layer to the schema layer at module-load time.

---

## Implementation Tasks

### Task 1: Extend `DocumentFormat` enum with `SEA_HTML`

**Files:**
- Modify: `src/data_migrator/schemas/models/fingerprint.py`

**Test cases:**
- ✅ Positive: `DocumentFormat("sea_html")` returns `DocumentFormat.SEA_HTML` (no KeyError)
- ✅ Positive: `DocumentFormat.SEA_HTML.value == "sea_html"`
- ✅ Positive: `DocumentFormat.FROALA_HTML` still equals `"froala_html"` (regression check)
- ✅ Positive: `DocumentFormat.UNKNOWN` still equals `"unknown"` (regression check)

**Implementation:**

In `src/data_migrator/schemas/models/fingerprint.py`, locate `class DocumentFormat(StrEnum)` and add one line:

```python
class DocumentFormat(StrEnum):
    FROALA_HTML = "froala_html"
    SEA_HTML = "sea_html"       # ← add this
    UNKNOWN = "unknown"
```

No separate test file needed — the new value is exercised by detector tests in Task 2.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Create `SeaContractsFormatDetector`

**Files:**
- Create: `src/data_migrator/detectors/sea/__init__.py`
- Create: `src/data_migrator/detectors/sea/sea_contracts_format_detector.py`
- Create: `tests/unit/detectors/sea/__init__.py`
- Create: `tests/unit/detectors/sea/test_sea_contracts_format_detector.py`

**Test cases:**
- ✅ Positive: `SeaContractsFormatDetector('<ins class="ice-ins ice-cts-1">text</ins>').matches()` returns `True`
- ✅ Positive: `SeaContractsFormatDetector('<del class="ice-del ice-cts-1">text</del>').matches()` returns `True`
- ✅ Positive: `SeaContractsFormatDetector(SEA_HTML).get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: `SeaContractsFormatDetector(SEA_HTML).extract_fingerprint_hash()` returns `"no-image"`
- ❌ Negative: `SeaContractsFormatDetector('<div class="fr-element fr-view">text</div>').matches()` returns `False`
- ❌ Negative: `SeaContractsFormatDetector("").matches()` returns `False`
- ❌ Negative: `SeaContractsFormatDetector("<html><body><p>plain</p></body></html>").matches()` returns `False`

**Implementation:**

```python
# src/data_migrator/detectors/sea/sea_contracts_format_detector.py
from __future__ import annotations

import structlog

from data_migrator.detectors.base import FormatDetectorInterface
from data_migrator.schemas.models.fingerprint import DocumentFormat

logger = structlog.get_logger(__name__)

_SEA_MARKERS = ("ice-ins", "ice-del")


class SeaContractsFormatDetector(FormatDetectorInterface):
    def matches(self) -> bool:
        return any(marker in self._content for marker in _SEA_MARKERS)

    def get_format(self) -> DocumentFormat:
        return DocumentFormat.SEA_HTML

    def extract_fingerprint_hash(self) -> str | None:
        return "no-image"
```

```python
# src/data_migrator/detectors/sea/__init__.py
from data_migrator.detectors.sea.sea_contracts_format_detector import SeaContractsFormatDetector

__all__ = ["SeaContractsFormatDetector"]
```

Test file structure (mirror `tests/unit/detectors/froala/test_froala_format_detector.py`):

```python
# tests/unit/detectors/sea/test_sea_contracts_format_detector.py
from __future__ import annotations

from data_migrator.detectors.sea.sea_contracts_format_detector import SeaContractsFormatDetector
from data_migrator.schemas.models.fingerprint import DocumentFormat

SEA_HTML_INS = '<div><ins class="ice-ins ice-cts-1">added text</ins></div>'
SEA_HTML_DEL = '<div><del class="ice-del ice-cts-2">deleted text</del></div>'
FROALA_HTML = '<div class="fr-element fr-view" dir="auto"><p>Content</p></div>'
PLAIN_HTML = "<html><body><p>Regular HTML</p></body></html>"
EMPTY_CONTENT = ""


class TestSeaContractsFormatDetector:
    def test_matches_ice_ins(self) -> None:
        assert SeaContractsFormatDetector(SEA_HTML_INS).matches() is True

    def test_matches_ice_del(self) -> None:
        assert SeaContractsFormatDetector(SEA_HTML_DEL).matches() is True

    def test_get_format_returns_sea_html(self) -> None:
        assert SeaContractsFormatDetector(SEA_HTML_INS).get_format() == DocumentFormat.SEA_HTML

    def test_extract_fingerprint_hash_returns_no_image(self) -> None:
        assert SeaContractsFormatDetector(SEA_HTML_INS).extract_fingerprint_hash() == "no-image"

    def test_does_not_match_froala_html(self) -> None:
        assert SeaContractsFormatDetector(FROALA_HTML).matches() is False

    def test_does_not_match_plain_html(self) -> None:
        assert SeaContractsFormatDetector(PLAIN_HTML).matches() is False

    def test_does_not_match_empty_content(self) -> None:
        assert SeaContractsFormatDetector(EMPTY_CONTENT).matches() is False
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Register `SeaContractsFormatDetector` in `FormatDetectorStrategy.create_default()`

**Files:**
- Modify: `src/data_migrator/detectors/format_detector_strategy.py`
- Modify: `tests/unit/detectors/test_format_detector_strategy.py`

**Test cases:**
- ✅ Positive: `FormatDetectorStrategy.create_default().list_detectors()` contains both `"froala"` and `"sea_contracts"`
- ✅ Positive: `FormatDetectorStrategy.create_default().detect('<ins class="ice-ins ice-cts-1">x</ins>').get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: `FormatDetectorStrategy.create_default().detect('<div class="fr-element fr-view">x</div>').get_format()` returns `DocumentFormat.FROALA_HTML` (regression)
- ❌ Negative: `FormatDetectorStrategy.create_default().detect("<html><p>plain</p></html>")` raises `FormatDetectionError`

**Implementation:**

Replace `FormatDetectorStrategy.create_default()` body in `src/data_migrator/detectors/format_detector_strategy.py`:

```python
@classmethod
def create_default(cls) -> FormatDetectorStrategy:
    from data_migrator.detectors.froala.froala_format_detector import FroalaFormatDetector
    from data_migrator.detectors.sea.sea_contracts_format_detector import SeaContractsFormatDetector

    strategy = cls()
    strategy.register_detector("froala", FroalaFormatDetector)
    strategy.register_detector("sea_contracts", SeaContractsFormatDetector)
    return strategy
```

Add to `tests/unit/detectors/test_format_detector_strategy.py`:

```python
SEA_HTML = '<div><ins class="ice-ins ice-cts-1">added text</ins></div>'

class TestFormatDetectorStrategy:
    # ... existing tests unchanged ...

    def test_create_default_includes_sea_contracts(self) -> None:
        strategy = FormatDetectorStrategy.create_default()
        assert "sea_contracts" in strategy.list_detectors()

    def test_detect_sea_contracts(self) -> None:
        strategy = FormatDetectorStrategy.create_default()
        detector = strategy.detect(SEA_HTML)
        assert detector.get_format() == DocumentFormat.SEA_HTML

    def test_detect_froala_still_works(self) -> None:
        strategy = FormatDetectorStrategy.create_default()
        detector = strategy.detect(FROALA_HTML)
        assert detector.get_format() == DocumentFormat.FROALA_HTML
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 4: Add `format_to_parser_name()` bridge to `TokenizerStrategy`

**Files:**
- Modify: `src/data_migrator/processors/tokenizer_strategy.py`
- Modify: `tests/unit/processors/test_tokenizer_strategy.py`

**Test cases:**
- ✅ Positive: `TokenizerStrategy.format_to_parser_name(DocumentFormat.FROALA_HTML)` returns `"froala"`
- ✅ Positive: `TokenizerStrategy.format_to_parser_name(DocumentFormat.SEA_HTML)` returns `"sea_contracts"`
- ❌ Negative: `TokenizerStrategy.format_to_parser_name(DocumentFormat.UNKNOWN)` raises `ParserNotFoundError` with the format value in the message

**Implementation:**

Add the class-level constant and static method to `TokenizerStrategy` in `src/data_migrator/processors/tokenizer_strategy.py`, after `list_tokenizers()`:

```python
_FORMAT_TO_PARSER: dict[str, str] = {
    "froala_html": "froala",
    "sea_html": "sea_contracts",
}

@staticmethod
def format_to_parser_name(document_format: DocumentFormat) -> str:
    """Map a detected DocumentFormat to a registered parser name.

    Raises:
        ParserNotFoundError: If no parser is registered for this format.
    """
    name = TokenizerStrategy._FORMAT_TO_PARSER.get(document_format.value)
    if name is None:
        raise ParserNotFoundError(
            f"No parser registered for format '{document_format.value}'"
        )
    return name
```

Note: `DocumentFormat` import goes in the method signature. Add `from data_migrator.schemas.models.fingerprint import DocumentFormat` to the `TYPE_CHECKING` block (or top-level if already present elsewhere in the file).

Check the current imports in `src/data_migrator/processors/tokenizer_strategy.py` and add `DocumentFormat` import appropriately:

```python
# If not already present, add to top of file:
from data_migrator.schemas.models.fingerprint import DocumentFormat
```

Add to `tests/unit/processors/test_tokenizer_strategy.py`:

```python
from data_migrator.schemas.models.fingerprint import DocumentFormat

def test_format_to_parser_name_froala() -> None:
    assert TokenizerStrategy.format_to_parser_name(DocumentFormat.FROALA_HTML) == "froala"

def test_format_to_parser_name_sea_contracts() -> None:
    assert TokenizerStrategy.format_to_parser_name(DocumentFormat.SEA_HTML) == "sea_contracts"

def test_format_to_parser_name_unknown_raises() -> None:
    with pytest.raises(ParserNotFoundError, match="unknown"):
        TokenizerStrategy.format_to_parser_name(DocumentFormat.UNKNOWN)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 5: Add `detect_and_parse()` to `SourceDocumentParser`

**Files:**
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

**Test cases:**
- ✅ Positive: given mock `FormatDetectorStrategy` that returns a detector with `get_format() == DocumentFormat.FROALA_HTML`, `detect_and_parse(FROALA_HTML)` calls `parse_content()` with `parser_name="froala"` and returns `SourceDocument`
- ✅ Positive: given mock detector returning `DocumentFormat.SEA_HTML`, `detect_and_parse(SEA_HTML)` calls `parse_content()` with `parser_name="sea_contracts"`
- ✅ Positive: `SourceDocumentParser(format_detector_strategy=None).detect_and_parse(SEA_HTML)` auto-creates `FormatDetectorStrategy.create_default()` internally (integration: no explicit strategy passed)
- ❌ Negative: given mock strategy that raises `FormatDetectionError`, `detect_and_parse(unknown_html)` re-raises `FormatDetectionError`

**Implementation:**

Modify `SourceDocumentParser.__init__` signature to accept `format_detector_strategy`:

```python
def __init__(
    self,
    tokenizer_strategy: TokenizerStrategy | None = None,
    format_detector_strategy: FormatDetectorStrategy | None = None,
) -> None:
    self.tokenizer_strategy = tokenizer_strategy or TokenizerStrategy.create_default()
    self._format_detector_strategy = format_detector_strategy
```

Add new method after `parse_file()`:

```python
def detect_and_parse(
    self,
    content: str,
    encoding: str = "utf-8",
    token_filter: TokenFilter | None = None,
) -> SourceDocument:
    """Auto-detect document format and parse using the matching parser.

    Raises:
        FormatDetectionError: If content format cannot be detected.
    """
    if self._format_detector_strategy is None:
        from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy
        self._format_detector_strategy = FormatDetectorStrategy.create_default()

    detector = self._format_detector_strategy.detect(content)
    parser_name = self.tokenizer_strategy.format_to_parser_name(detector.get_format())
    logger.debug("auto_detected_parser", parser_name=parser_name)
    return self.parse_content(
        content=content,
        parser_name=parser_name,
        encoding=encoding,
        token_filter=token_filter,
    )
```

Add required import at the top of `source_document_parser.py` (inside `TYPE_CHECKING` or directly):

```python
from data_migrator.processors.tokenizer_strategy import TokenizerStrategy  # already imported
# Add FormatDetectorStrategy to TYPE_CHECKING block:
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy
```

Add tests to `tests/unit/services/source_parsing/test_source_document_parser.py`:

```python
from unittest.mock import Mock, MagicMock
from data_migrator.exceptions import FormatDetectionError
from data_migrator.schemas.models.fingerprint import DocumentFormat

class TestSourceDocumentParserDetectAndParse:
    def test_detect_and_parse_froala(
        self, mock_strategy: Mock, mock_parser: Mock
    ) -> None:
        mock_detector = Mock()
        mock_detector.get_format.return_value = DocumentFormat.FROALA_HTML
        mock_format_strategy = Mock()
        mock_format_strategy.detect.return_value = mock_detector
        mock_strategy.get_parser.return_value = mock_parser
        mock_strategy.format_to_parser_name.return_value = "froala"

        parser = SourceDocumentParser(
            tokenizer_strategy=mock_strategy,
            format_detector_strategy=mock_format_strategy,
        )
        result = parser.detect_and_parse('<div class="fr-element fr-view">text</div>')

        mock_format_strategy.detect.assert_called_once()
        mock_strategy.format_to_parser_name.assert_called_once_with(DocumentFormat.FROALA_HTML)
        assert isinstance(result, SourceDocument)

    def test_detect_and_parse_sea_contracts(
        self, mock_strategy: Mock, mock_parser: Mock
    ) -> None:
        mock_detector = Mock()
        mock_detector.get_format.return_value = DocumentFormat.SEA_HTML
        mock_format_strategy = Mock()
        mock_format_strategy.detect.return_value = mock_detector
        mock_strategy.get_parser.return_value = mock_parser
        mock_strategy.format_to_parser_name.return_value = "sea_contracts"

        parser = SourceDocumentParser(
            tokenizer_strategy=mock_strategy,
            format_detector_strategy=mock_format_strategy,
        )
        result = parser.detect_and_parse('<ins class="ice-ins ice-cts-1">added</ins>')

        mock_strategy.format_to_parser_name.assert_called_once_with(DocumentFormat.SEA_HTML)
        assert isinstance(result, SourceDocument)

    def test_detect_and_parse_unknown_raises(
        self, mock_strategy: Mock
    ) -> None:
        mock_format_strategy = Mock()
        mock_format_strategy.detect.side_effect = FormatDetectionError("unknown format")

        parser = SourceDocumentParser(
            tokenizer_strategy=mock_strategy,
            format_detector_strategy=mock_format_strategy,
        )
        with pytest.raises(FormatDetectionError):
            parser.detect_and_parse("<html><p>regular html</p></html>")

    def test_detect_and_parse_auto_creates_format_strategy(
        self, mock_strategy: Mock, mock_parser: Mock
    ) -> None:
        """detect_and_parse with format_detector_strategy=None falls back to create_default()."""
        mock_strategy.get_parser.return_value = mock_parser
        mock_strategy.format_to_parser_name.return_value = "sea_contracts"

        parser = SourceDocumentParser(tokenizer_strategy=mock_strategy)
        # Uses real FormatDetectorStrategy.create_default() — SEA HTML must be detected
        result = parser.detect_and_parse('<ins class="ice-ins ice-cts-1">added</ins>')

        assert isinstance(result, SourceDocument)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — structural template for `SeaContractsFormatDetector`
- `src/data_migrator/detectors/base.py:FormatDetectorInterface` — ABC to implement
- `src/data_migrator/processors/tokenizer_strategy.py:TokenizerStrategy` — extended with static bridge
- `src/data_migrator/exceptions.py:FormatDetectionError` — reuse for unknown format errors
- `src/data_migrator/exceptions.py:ParserNotFoundError` — reuse in `format_to_parser_name()`

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/fingerprint.py` — `DocumentFormat` StrEnum extended here

**Patterns to follow:**
- `_FROALA_MARKERS = (...)` tuple constant → `_SEA_MARKERS = ("ice-ins", "ice-del")` same pattern
- Deferred imports in `create_default()` factory methods (lazy-import pattern in all strategy classes)
- `structlog.get_logger(__name__)` for module-level logger
- `from __future__ import annotations` at the top of all model/service files

**Test helpers to use:**
- Direct pytest class-based tests (no special helpers needed for detector tests)
- `Mock(spec=...)` for strategy mocks in service tests

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
pytest tests/unit/detectors/ tests/unit/processors/test_tokenizer_strategy.py tests/unit/services/source_parsing/ -v --cov=src/data_migrator/detectors --cov=src/data_migrator/processors/tokenizer_strategy --cov=src/data_migrator/services/source_parsing
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

### Edge Cases to Test

- HTML with both `ice-ins` and `fr-element` markers: Froala is registered first; result depends on registration order in `create_default()`
- `DocumentFormat.UNKNOWN` passed to `format_to_parser_name()` raises `ParserNotFoundError` with `"unknown"` in message
- `detect_and_parse()` called with `format_detector_strategy=None` creates strategy lazily on first call
- `extract_fingerprint_hash()` on `SeaContractsFormatDetector` always returns `"no-image"` (no fingerprint image in Sea Contracts exports)

---

## Success Criteria

**Must have:**
- `SeaContractsFormatDetector.matches()` returns `True` for HTML containing `ice-ins` or `ice-del`
- `FormatDetectorStrategy.create_default().list_detectors()` contains both `"froala"` and `"sea_contracts"`
- `TokenizerStrategy.format_to_parser_name(DocumentFormat.SEA_HTML)` returns `"sea_contracts"`
- `TokenizerStrategy.format_to_parser_name(DocumentFormat.FROALA_HTML)` returns `"froala"`
- `SourceDocumentParser.detect_and_parse()` completes full auto-detection → bridge → parse flow
- All existing tests pass (no regressions to `FroalaFormatDetector`, `FormatDetectorStrategy`, `TokenizerStrategy`)
- Static analysis passes (ruff, mypy strict, radon MI >= A, CC <= B)

**Nice to have:**
- Integration test: full `detect_and_parse()` round-trip with a real SEA Contracts fixture HTML file

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found in `docs/designs/`

**Memories Referenced:**
- `project_overview` — architecture layers, parser strategy pattern
- `architecture_patterns` — layer separation rules, SOLID principles

**Similar Implementations:**
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — serves as structural template for `SeaContractsFormatDetector`
- `src/data_migrator/processors/tokenizer_strategy.py:TokenizerStrategy` — extended with static bridge method
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — registry pattern being extended with second detector
