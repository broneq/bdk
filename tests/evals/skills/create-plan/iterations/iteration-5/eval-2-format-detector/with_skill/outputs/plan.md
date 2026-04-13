# Plan: Document Format Detector with Auto-Parser Selection

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Implement a `SeaFormatDetector` and `FormatParserResolver` so any caller can auto-select the right tokenizer parser from HTML structure alone without manually specifying `parser_name`.
**Architecture:** Add `SEA_HTML` to the `DocumentFormat` enum, implement `SeaFormatDetector` following the existing `FroalaFormatDetector` pattern, register it in `FormatDetectorStrategy.create_default()`, and add a `FormatParserResolver` that maps `DocumentFormat → parser_name`. Wire the resolver into `SourceDocumentParser` so `parse_content(..., parser_name="auto")` works transparently. Update `DefaultContainer` to inject the new resolver.
**Complexity:** MEDIUM

---

## Context

The codebase has a two-layer detection/parsing system:

1. **Format detection** (`detectors/` layer): `FormatDetectorStrategy` iterates registered `FormatDetectorInterface` implementations. Currently only `FroalaFormatDetector` is registered. It checks HTML markers and returns a `FormatDetectorInterface` instance. When no detector matches, `FormatDetectionError` is raised.

2. **Parser selection** (`processors/tokenizer_strategy.py`): `TokenizerStrategy` maps string keys (`"froala"`, `"sea_contracts"`) to parser classes. `SeaContractsParser` is already registered under `"sea_contracts"`. Callers must provide `parser_name` explicitly.

The gap: there is no bridge from a detected `DocumentFormat` value to a `TokenizerStrategy` name string. Callers (CLI, API, use cases) must always supply the parser name manually even though the format is detectable from HTML markers (ICE/CKEditor attributes like `ins data-cid`, `del data-cid`, `data-author-id`).

This plan introduces:
- `DocumentFormat.SEA_HTML` enum value
- `SeaFormatDetector` implementing `FormatDetectorInterface`
- Registration in `FormatDetectorStrategy.create_default()`
- `FormatParserResolver` — a single-responsibility class mapping `DocumentFormat → parser_name`
- Auto-detection path in `SourceDocumentParser` when `parser_name == "auto"`
- Container wiring in `DefaultContainer`

No CLI or use-case changes are in scope — callers opt in by passing `parser_name="auto"`.

---

## Explored Approaches

### Approach 1: SeaFormatDetector + FormatParserResolver (Selected)

**Description:** Add SEA format detection and a dedicated `FormatParserResolver` class following SRP. The resolver holds the `DocumentFormat → parser_name` mapping as an injected `dict`. `SourceDocumentParser` accepts an optional `FormatParserResolver` dependency and uses it when `parser_name == "auto"`.

**Design pattern:** Strategy (existing detector strategy) + Registry (new `FormatParserResolver`)

**OO principles:** SRP (resolver has one job: map format to parser name), OCP (new formats require only a new detector + one resolver entry), DIP (`SourceDocumentParser` depends on injectable resolver, not hardcoded mapping)

**Pros:**
- `FormatParserResolver` is independently testable — pure dict lookup
- `SourceDocumentParser` changes are minimal: one helper method `_resolve_parser_name()`
- Adding a third format (e.g., PDF) requires zero changes to `SourceDocumentParser`

**Cons:**
- Two registries must stay in sync: `FormatDetectorStrategy` (detectors) and `FormatParserResolver` (name mapping)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/schemas/models/fingerprint.py` — add `SEA_HTML`
- `src/data_migrator/detectors/sea/__init__.py` — new file
- `src/data_migrator/detectors/sea/sea_format_detector.py` — new file
- `src/data_migrator/detectors/format_detector_strategy.py` — register SEA detector
- `src/data_migrator/processors/format_parser_resolver.py` — new file
- `src/data_migrator/services/source_parsing/source_document_parser.py` — accept resolver, handle `"auto"`
- `src/data_migrator/containers/base.py` — wire `FormatParserResolver`
- `tests/unit/detectors/sea/__init__.py` — new file
- `tests/unit/detectors/sea/test_sea_format_detector.py` — new file
- `tests/unit/processors/test_format_parser_resolver.py` — new file
- `tests/unit/services/source_parsing/test_source_document_parser_auto.py` — new file

---

### Approach 2: Auto-detect Inline in SourceDocumentParser (Not Selected)

**Description:** When `parser_name == "auto"`, `SourceDocumentParser.parse_content()` instantiates `FormatDetectorStrategy` internally and maps the detected format to a parser name using an inline `dict`. No new classes needed.

**Pros / Cons:** Fewer files to create, but breaks SRP (parser method also does detection + name mapping), hard to test the mapping independently, tightly coupled to both layers.

**Why not selected:** Violates SRP and DIP. The mapping logic becomes invisible inside a method. Extending to a third format requires editing the parser method directly.

---

### Approach 3: FormatDetectorStrategy Grows a resolve_parser_name() Method (Not Selected)

**Description:** Add `resolve_parser_name(content: str) -> str` directly to `FormatDetectorStrategy` — detect and map in one call.

**Pros / Cons:** Single call site, but overloads `FormatDetectorStrategy` with two responsibilities (detection and name resolution). It also creates a downward dependency from the `detectors/` layer to `processors/` string names.

**Why not selected:** Violates SRP and layer boundaries. `FormatDetectorStrategy` belongs to `detectors/`; parser name strings are `processors/` concerns. Mixing them creates a cross-layer coupling that cannot be easily reversed.

---

## Selected Approach: SeaFormatDetector + FormatParserResolver

**Rationale:** Each class has exactly one responsibility. The pattern mirrors the existing `FroalaFormatDetector` exactly, making it immediately familiar. The resolver is independently testable and easily extended without touching `SourceDocumentParser`. Low complexity, low risk.

---

## Implementation Tasks

### Task 1: Add SEA_HTML to DocumentFormat enum

**Files:**
- Modify: `src/data_migrator/schemas/models/fingerprint.py`

**Test cases:**
- ✅ Positive: `DocumentFormat.SEA_HTML` has string value `"sea_html"`
- ✅ Positive: `DocumentFormat.SEA_HTML` is distinct from `DocumentFormat.FROALA_HTML` and `DocumentFormat.UNKNOWN`
- ✅ Positive: `DocumentFormat.SEA_HTML` is iterable from `list(DocumentFormat)` alongside other values

**Test scaffold:**
```python
# Setup: no fixture needed — plain enum import
from data_migrator.schemas.models.fingerprint import DocumentFormat

def test_sea_html_enum_value():
    assert DocumentFormat.SEA_HTML == "sea_html"

def test_sea_html_distinct_from_froala():
    assert DocumentFormat.SEA_HTML != DocumentFormat.FROALA_HTML

def test_sea_html_in_enum_members():
    members = list(DocumentFormat)
    assert DocumentFormat.SEA_HTML in members
```

**Implementation:**
```python
class DocumentFormat(StrEnum):
    FROALA_HTML = "froala_html"
    SEA_HTML = "sea_html"      # ← add this line
    UNKNOWN = "unknown"
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Implement SeaFormatDetector

**Files:**
- Create: `src/data_migrator/detectors/sea/__init__.py`
- Create: `src/data_migrator/detectors/sea/sea_format_detector.py`
- Create: `tests/unit/detectors/sea/__init__.py`
- Create: `tests/unit/detectors/sea/test_sea_format_detector.py`

**Test cases:**
- ✅ Positive: given HTML containing `ins data-cid`, `matches()` returns `True`
- ✅ Positive: given HTML containing `del data-cid`, `matches()` returns `True`
- ✅ Positive: given HTML containing `data-author-id`, `matches()` returns `True`
- ✅ Positive: given HTML with `ins data-cid`, `get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: given plain `<p>text</p>` with no ICE markers, `matches()` returns `False`
- ❌ Negative: given Froala-only HTML with `fr-element` but no ICE markers, `matches()` returns `False`
- ✅ Positive: `extract_fingerprint_hash()` returns `"no-image"` for HTML with no identifiable image

**Test scaffold:**
```python
# Setup: no fixture needed
from data_migrator.detectors.sea.sea_format_detector import SeaFormatDetector
from data_migrator.schemas.models.fingerprint import DocumentFormat

SEA_INS = '<ins data-cid="1" data-author-id="user1">added text</ins>'
SEA_DEL = '<del data-cid="2">removed text</del>'
SEA_AUTHOR = '<p data-author-id="user1">para</p>'
PLAIN_HTML = "<p>regular text</p>"
FROALA_HTML = '<div class="fr-element">text</div>'

def test_matches_ins_data_cid():
    detector = SeaFormatDetector(SEA_INS)
    assert detector.matches() is True

def test_matches_del_data_cid():
    detector = SeaFormatDetector(SEA_DEL)
    assert detector.matches() is True

def test_matches_data_author_id():
    detector = SeaFormatDetector(SEA_AUTHOR)
    assert detector.matches() is True

def test_get_format_returns_sea_html():
    detector = SeaFormatDetector(SEA_INS)
    assert detector.get_format() == DocumentFormat.SEA_HTML

def test_does_not_match_plain_html():
    detector = SeaFormatDetector(PLAIN_HTML)
    assert detector.matches() is False

def test_does_not_match_froala_only():
    detector = SeaFormatDetector(FROALA_HTML)
    assert detector.matches() is False

def test_extract_fingerprint_hash_returns_no_image():
    detector = SeaFormatDetector(SEA_INS)
    assert detector.extract_fingerprint_hash() == "no-image"
```

**Implementation:**
```python
# src/data_migrator/detectors/sea/sea_format_detector.py
from __future__ import annotations

from data_migrator.detectors.base import FormatDetectorInterface
from data_migrator.schemas.models.fingerprint import DocumentFormat

_SEA_MARKERS = ("ins data-cid", "del data-cid", "data-author-id")


class SeaFormatDetector(FormatDetectorInterface):
    def matches(self) -> bool:
        return any(marker in self._content for marker in _SEA_MARKERS)

    def get_format(self) -> DocumentFormat:
        return DocumentFormat.SEA_HTML

    def extract_fingerprint_hash(self) -> str | None:
        return "no-image"
```

`src/data_migrator/detectors/sea/__init__.py` — empty file.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Register SeaFormatDetector in FormatDetectorStrategy.create_default()

**Files:**
- Modify: `src/data_migrator/detectors/format_detector_strategy.py`
- Modify: `tests/unit/detectors/test_format_detector_strategy.py`

**Test cases:**
- ✅ Positive: `FormatDetectorStrategy.create_default().list_detectors()` contains `"sea_contracts"`
- ✅ Positive: given SEA HTML with `ins data-cid`, `strategy.detect(content).get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: given Froala HTML with `fr-element`, `strategy.detect(content).get_format()` returns `DocumentFormat.FROALA_HTML`

**Test scaffold:**
```python
# Setup: no fixture
from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy
from data_migrator.schemas.models.fingerprint import DocumentFormat

SEA_CONTENT = '<ins data-cid="1">added</ins>'
FROALA_CONTENT = '<div class="fr-element fr-view">text</div>'

def test_create_default_includes_sea_detector():
    strategy = FormatDetectorStrategy.create_default()
    assert "sea_contracts" in strategy.list_detectors()

def test_detects_sea_format_from_content():
    strategy = FormatDetectorStrategy.create_default()
    detector = strategy.detect(SEA_CONTENT)
    assert detector.get_format() == DocumentFormat.SEA_HTML

def test_detects_froala_format_from_content():
    strategy = FormatDetectorStrategy.create_default()
    detector = strategy.detect(FROALA_CONTENT)
    assert detector.get_format() == DocumentFormat.FROALA_HTML
```

**Implementation:**
Add to `create_default()` after registering froala:
```python
from data_migrator.detectors.sea.sea_format_detector import SeaFormatDetector
strategy.register_detector("sea_contracts", SeaFormatDetector)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 4: Implement FormatParserResolver

**Files:**
- Create: `src/data_migrator/processors/format_parser_resolver.py`
- Create: `tests/unit/processors/test_format_parser_resolver.py`

**Test cases:**
- ✅ Positive: given `DocumentFormat.FROALA_HTML`, `resolver.resolve()` returns `"froala"`
- ✅ Positive: given `DocumentFormat.SEA_HTML`, `resolver.resolve()` returns `"sea_contracts"`
- ✅ Positive: `FormatParserResolver.create_default()` returns a resolver handling both known formats
- ❌ Negative: given `DocumentFormat.UNKNOWN`, `resolve()` raises `ParserNotFoundError` with `"unknown"` in the message

**Test scaffold:**
```python
# Setup: no fixture
import pytest
from data_migrator.processors.format_parser_resolver import FormatParserResolver
from data_migrator.schemas.models.fingerprint import DocumentFormat
from data_migrator.exceptions import ParserNotFoundError

def test_resolve_froala():
    resolver = FormatParserResolver.create_default()
    assert resolver.resolve(DocumentFormat.FROALA_HTML) == "froala"

def test_resolve_sea_contracts():
    resolver = FormatParserResolver.create_default()
    assert resolver.resolve(DocumentFormat.SEA_HTML) == "sea_contracts"

def test_create_default_handles_both_formats():
    resolver = FormatParserResolver.create_default()
    assert resolver.resolve(DocumentFormat.FROALA_HTML) == "froala"
    assert resolver.resolve(DocumentFormat.SEA_HTML) == "sea_contracts"

def test_resolve_unknown_raises_parser_not_found():
    resolver = FormatParserResolver.create_default()
    with pytest.raises(ParserNotFoundError, match="unknown"):
        resolver.resolve(DocumentFormat.UNKNOWN)
```

**Implementation:**
```python
# src/data_migrator/processors/format_parser_resolver.py
from __future__ import annotations

import structlog

from data_migrator.exceptions import ParserNotFoundError
from data_migrator.schemas.models.fingerprint import DocumentFormat

logger = structlog.get_logger(__name__)


class FormatParserResolver:
    def __init__(self, mapping: dict[DocumentFormat, str]) -> None:
        self._mapping = mapping

    @classmethod
    def create_default(cls) -> FormatParserResolver:
        return cls({
            DocumentFormat.FROALA_HTML: "froala",
            DocumentFormat.SEA_HTML: "sea_contracts",
        })

    def resolve(self, format: DocumentFormat) -> str:
        """Raises:
            ParserNotFoundError: If no parser is registered for the given format.
        """
        if format not in self._mapping:
            logger.error("parser_not_found_for_format", format=format.value)
            raise ParserNotFoundError(
                f"No parser registered for format: {format.value}"
            )
        return self._mapping[format]
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 5: Wire auto-detection into SourceDocumentParser

**Files:**
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Create: `tests/unit/services/source_parsing/test_source_document_parser_auto.py`

**Test cases:**
- ✅ Positive: given `parser_name="auto"` and Froala HTML (`fr-element`), `parse_content()` uses the Froala parser (result `metadata.parser == "FroalaParser"`)
- ✅ Positive: given `parser_name="auto"` and SEA HTML (`ins data-cid`), `parse_content()` uses the SEA parser (result `metadata.parser == "SeaContractsParser"`)
- ✅ Positive: given explicit `parser_name="froala"`, no auto-detection code runs (existing behavior preserved, verified via mock that `_format_detector_strategy.detect` is NOT called)
- ❌ Negative: given `parser_name="auto"` and unrecognizable HTML (no markers), `parse_content()` raises `FormatDetectionError`

**Test scaffold:**
```python
# Setup: no fixture — use SourceDocumentParser with real parsers for auto tests,
#         mock FormatDetectorStrategy for the "no auto on explicit" test
from unittest.mock import Mock
import pytest
from data_migrator.services.source_parsing.source_document_parser import SourceDocumentParser
from data_migrator.exceptions import FormatDetectionError
from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy

FROALA_CONTENT = '<div class="fr-element fr-view"><p>text</p></div>'
SEA_CONTENT = '<ins data-cid="1" data-author-id="u1">added</ins>'
UNKNOWN_CONTENT = "<p>plain text no markers</p>"

def test_auto_selects_froala_parser():
    parser = SourceDocumentParser()
    result = parser.parse_content(FROALA_CONTENT, parser_name="auto", encoding="utf-8")
    assert result.metadata.parser == "FroalaParser"

def test_auto_selects_sea_parser():
    parser = SourceDocumentParser()
    result = parser.parse_content(SEA_CONTENT, parser_name="auto", encoding="utf-8")
    assert result.metadata.parser == "SeaContractsParser"

def test_explicit_parser_name_skips_auto_detection():
    mock_detector_strategy = Mock(spec=FormatDetectorStrategy)
    parser = SourceDocumentParser(format_detector_strategy=mock_detector_strategy)
    # passes explicit name — detect() must never be called
    result = parser.parse_content(FROALA_CONTENT, parser_name="froala", encoding="utf-8")
    mock_detector_strategy.detect.assert_not_called()

def test_auto_unknown_content_raises_format_detection_error():
    parser = SourceDocumentParser()
    with pytest.raises(FormatDetectionError):
        parser.parse_content(UNKNOWN_CONTENT, parser_name="auto", encoding="utf-8")
```

**Implementation:**
```python
# src/data_migrator/services/source_parsing/source_document_parser.py
from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy
from data_migrator.processors.format_parser_resolver import FormatParserResolver

class SourceDocumentParser:
    def __init__(
        self,
        tokenizer_strategy: TokenizerStrategy | None = None,
        format_detector_strategy: FormatDetectorStrategy | None = None,
        format_parser_resolver: FormatParserResolver | None = None,
    ) -> None:
        self.tokenizer_strategy = tokenizer_strategy or TokenizerStrategy.create_default()
        self._format_detector_strategy = (
            format_detector_strategy or FormatDetectorStrategy.create_default()
        )
        self._format_parser_resolver = (
            format_parser_resolver or FormatParserResolver.create_default()
        )

    def _resolve_parser_name(self, content: str, parser_name: str) -> str:
        if parser_name != "auto":
            return parser_name
        detector = self._format_detector_strategy.detect(content)
        return self._format_parser_resolver.resolve(detector.get_format())

    @timed
    def parse_content(
        self,
        content: str,
        parser_name: str,
        encoding: str,
        token_filter: TokenFilter | None = None,
    ) -> SourceDocument:
        logger.debug("getting_parser", parser_name=parser_name)
        resolved_name = self._resolve_parser_name(content, parser_name)
        parser = self.tokenizer_strategy.get_parser(
            name=resolved_name, content=content, encoding=encoding
        )
        logger.debug("executing_parser")
        return parser.parse(token_filter=token_filter)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 6: Wire FormatParserResolver into DefaultContainer

**Files:**
- Modify: `src/data_migrator/containers/base.py`

**Test cases:**
- ✅ Positive: `container.get_source_document_parser()._format_parser_resolver.resolve(DocumentFormat.FROALA_HTML)` returns `"froala"`
- ✅ Positive: `container.get_source_document_parser()._format_parser_resolver.resolve(DocumentFormat.SEA_HTML)` returns `"sea_contracts"`
- ✅ Positive: `container.get_source_document_parser()._format_detector_strategy.list_detectors()` contains `"sea_contracts"`

**Test scaffold:**
```python
# Setup: DefaultContainer (no mocks needed — verifying DI wiring)
from data_migrator.containers.base import DefaultContainer
from data_migrator.schemas.models.fingerprint import DocumentFormat

def test_container_resolver_maps_froala():
    container = DefaultContainer()
    svc = container.get_source_document_parser()
    assert svc._format_parser_resolver.resolve(DocumentFormat.FROALA_HTML) == "froala"

def test_container_resolver_maps_sea():
    container = DefaultContainer()
    svc = container.get_source_document_parser()
    assert svc._format_parser_resolver.resolve(DocumentFormat.SEA_HTML) == "sea_contracts"

def test_container_detector_strategy_includes_sea():
    container = DefaultContainer()
    svc = container.get_source_document_parser()
    assert "sea_contracts" in svc._format_detector_strategy.list_detectors()
```

**Implementation:**

In `DefaultContainer.__init__()`, add override attribute:
```python
self._format_parser_resolver: FormatParserResolver | None = None
```

Add TYPE_CHECKING import:
```python
from data_migrator.processors.format_parser_resolver import FormatParserResolver
```

Add getter:
```python
def get_format_parser_resolver(self) -> FormatParserResolver:
    def factory() -> FormatParserResolver:
        if self._format_parser_resolver is not None:
            return self._format_parser_resolver
        from data_migrator.processors.format_parser_resolver import FormatParserResolver
        return FormatParserResolver.create_default()
    return self._get_or_create("format_parser_resolver", factory)
```

Update `get_source_document_parser()`:
```python
return SourceDocumentParser(
    format_detector_strategy=self.get_format_detector_strategy(),
    format_parser_resolver=self.get_format_parser_resolver(),
)
```

Add setter:
```python
def set_format_parser_resolver(self, resolver: FormatParserResolver) -> None:
    with self._lock:
        self._format_parser_resolver = resolver
        self._invalidate_scope()
```

Add `self._format_parser_resolver = None` to `_clear_all_overrides()`.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/detectors/base.py:FormatDetectorInterface` — base class, implement `matches()`, `get_format()`, `extract_fingerprint_hash()`
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — exact reference implementation to follow
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — registration via `register_detector(name, class)`
- `src/data_migrator/processors/tokenizer_strategy.py:TokenizerStrategy` — existing parser registry, already has `"sea_contracts"` registered
- `src/data_migrator/containers/base.py:DefaultContainer._get_or_create` — lazy init pattern to follow for new getter

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/fingerprint.py` — `DocumentFormat` StrEnum to extend with `SEA_HTML`
- `src/data_migrator/exceptions.py` — `FormatDetectionError`, `ParserNotFoundError` already exist

**Patterns to follow:**
- Detector subpackage layout: `detectors/<name>/__init__.py` + `detectors/<name>/<name>_format_detector.py`
- Marker-based `matches()`: `any(marker in self._content for marker in _MARKERS)` — no BeautifulSoup needed for simple string checks
- `create_default()` classmethod factory on strategy/resolver classes
- Container lazy init: `_get_or_create("key", factory)` pattern with override attribute + setter
- `from __future__ import annotations` at top of all new files

**Test helpers to use:**
- Plain `pytest` unit tests — no fixtures needed for detector or resolver tests
- `DefaultContainer` directly for container wiring tests (Tasks 6)

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/detectors/sea/ tests/unit/processors/test_format_parser_resolver.py tests/unit/services/source_parsing/test_source_document_parser_auto.py tests/unit/detectors/test_format_detector_strategy.py -v --cov=src/data_migrator/detectors/sea --cov=src/data_migrator/processors/format_parser_resolver --cov=src/data_migrator/services/source_parsing/source_document_parser
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

- HTML containing both Froala and SEA markers simultaneously — strategy iterates in insertion order; order of `register_detector` calls determines which wins
- Empty string content — `SeaFormatDetector("").matches()` returns `False`
- `FormatParserResolver({})` constructed with empty mapping — `resolve()` raises `ParserNotFoundError` for any format
- `parse_content(content, parser_name="auto")` when `FormatDetectorStrategy.detect()` raises `FormatDetectionError` — exception propagates unchanged through `_resolve_parser_name()`

---

## Success Criteria

**Must have:**
- `DocumentFormat.SEA_HTML` exists with string value `"sea_html"`
- `SeaFormatDetector.matches()` returns `True` for SEA ICE/CKEditor HTML
- `FormatDetectorStrategy.create_default()` includes `"sea_contracts"` detector
- `FormatParserResolver.create_default()` maps `FROALA_HTML → "froala"` and `SEA_HTML → "sea_contracts"`
- `SourceDocumentParser.parse_content(..., parser_name="auto")` auto-selects the correct parser
- `DefaultContainer` wires `FormatParserResolver` and exposes `set_format_parser_resolver()` for tests
- All tests pass
- Static analysis passes (ruff, mypy, radon MI >= A, CC <= B)
- Coverage meets thresholds

**Nice to have:**
- `import-template` CLI command gains `--parser=auto` support (out of scope)
- `FormatParserResolver.register()` instance method for runtime extensibility (out of scope)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found in `docs/designs/`

**Memories Referenced:**
- `utility_classes` — confirmed `TokenizerStrategy` and `FormatDetectorStrategy` are the right extension points
- `sea_contracts_format` — ICE/CKEditor markers (`ins data-cid`, `del data-cid`, `data-author-id`) confirm `_SEA_MARKERS` list

**Similar Implementations:**
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — exact reference for `SeaFormatDetector` structure
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — registration pattern for `create_default()`
- `src/data_migrator/containers/base.py:DefaultContainer.get_format_detector_strategy` — container wiring pattern to replicate for `get_format_parser_resolver`
