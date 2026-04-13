# Plan: Document Format Detector with Auto-Parser Selection

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Implement a SEA Contracts format detector and a format-to-parser resolver so any caller can auto-select the right tokenizer parser from HTML content alone.
**Architecture:** Add `SEA_HTML` to `DocumentFormat` enum, implement `SeaFormatDetector` following `FroalaFormatDetector` pattern, register it in `FormatDetectorStrategy.create_default()`, and add a `FormatParserResolver` that maps `DocumentFormat → parser_name` string. Wire the resolver into `SourceDocumentParser` so `parse_content(..., parser_name="auto")` works transparently.
**Complexity:** MEDIUM

---

## Context

The codebase already has a two-layer detection system:

1. **Format detection** (`detectors/` layer): `FormatDetectorStrategy` iterates registered `FormatDetectorInterface` detectors. Currently only `FroalaFormatDetector` is registered. It inspects HTML markers and extracts a fingerprint hash.
2. **Parser selection** (`processors/tokenizer_strategy.py`): `TokenizerStrategy` maps string names (`"froala"`, `"sea_contracts"`) to parser classes. Callers provide `parser_name` explicitly — there is no automatic format→name bridge.

The gap: `SeaContractsParser` is registered under the name `"sea_contracts"` in `TokenizerStrategy`, but `FormatDetectorStrategy` has no SEA detector and there is no mapping from `DocumentFormat` values to `TokenizerStrategy` name keys. As a result, callers (CLI, API, use cases) must always supply the parser name manually.

This plan adds:
- `DocumentFormat.SEA_HTML` enum value
- `SeaFormatDetector` implementing `FormatDetectorInterface`
- Registration of the SEA detector in `FormatDetectorStrategy.create_default()`
- `FormatParserResolver` — a simple, single-responsibility class mapping `DocumentFormat → parser_name`
- Auto-detection path in `SourceDocumentParser` when `parser_name == "auto"`

No CLI or use-case changes are required in this plan — the resolver makes auto-selection available but callers opt in by passing `parser_name="auto"`.

---

## Explored Approaches

### Approach 1: SeaFormatDetector + FormatParserResolver (Selected)

**Description:** Add SEA format detection and a dedicated `FormatParserResolver` class (SRP). The resolver holds the `DocumentFormat → parser_name` mapping as a `dict` populated at construction. `SourceDocumentParser` accepts an optional `FormatParserResolver` and uses it when `parser_name == "auto"`.

**Design pattern:** Strategy (existing) + Registry (new `FormatParserResolver`)

**OO principles:** SRP (resolver has one job), OCP (add new formats without touching `SourceDocumentParser`), DIP (`SourceDocumentParser` depends on abstract resolver interface)

**Pros:**
- Resolver is easy to test in isolation — just a dict mapping
- `SourceDocumentParser` changes are minimal (one guard clause)
- Adding a third format (e.g., PDF) requires only a new detector + resolver entry

**Cons:**
- Two separate registries must be kept in sync (`FormatDetectorStrategy` + `FormatParserResolver`)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/schemas/models/fingerprint.py` — add `SEA_HTML`
- `src/data_migrator/detectors/sea/sea_format_detector.py` — new file
- `src/data_migrator/detectors/sea/__init__.py` — new file
- `src/data_migrator/detectors/format_detector_strategy.py` — register SEA detector
- `src/data_migrator/processors/format_parser_resolver.py` — new file
- `src/data_migrator/services/source_parsing/source_document_parser.py` — accept resolver, handle "auto"
- `src/data_migrator/containers/base.py` — wire `FormatParserResolver`
- `tests/unit/detectors/sea/test_sea_format_detector.py` — new file
- `tests/unit/processors/test_format_parser_resolver.py` — new file
- `tests/unit/services/source_parsing/test_source_document_parser_auto.py` — new file

---

### Approach 2: Auto-detect Inline in SourceDocumentParser (Not Selected)

**Description:** When `parser_name == "auto"`, `SourceDocumentParser.parse_content()` instantiates `FormatDetectorStrategy` internally, detects the format, and maps it to a parser name using an inline `dict`. No new classes needed.

**Pros / Cons:** Fewer files, but breaks SRP (parser now also does detection + mapping), not injected (hard to test), tightly coupled.

**Why not selected:** Violates SRP and DIP. The mapping logic becomes invisible inside a method, making it hard to test independently or extend.

---

### Approach 3: FormatDetectorStrategy Grows a resolve_parser_name() Method (Not Selected)

**Description:** Add `resolve_parser_name(content: str) -> str` directly to `FormatDetectorStrategy` — detect + map in one call.

**Pros / Cons:** Single entry point, but overloads `FormatDetectorStrategy` with two responsibilities (detection and name resolution), and couples format names to tokenizer strategy names inside the detector layer.

**Why not selected:** Violates SRP. `FormatDetectorStrategy` belongs to the `detectors/` layer; parser name strings belong to the `processors/` layer. Mixing them creates a downward dependency.

---

## Selected Approach: SeaFormatDetector + FormatParserResolver

**Rationale:** Keeps each class focused on one responsibility, follows the existing `FroalaFormatDetector` pattern exactly, and makes the format→parser mapping explicit and independently testable. Low complexity, low risk.

---

## Implementation Tasks

### Task 1: Add SEA_HTML to DocumentFormat enum

**Files:**
- Modify: `src/data_migrator/schemas/models/fingerprint.py`

**Test cases:**
- ✅ Positive: `DocumentFormat.SEA_HTML` has string value `"sea_html"`
- ✅ Positive: `DocumentFormat.SEA_HTML` is distinct from `DocumentFormat.FROALA_HTML` and `DocumentFormat.UNKNOWN`

**Test scaffold:**
```python
# Setup: no fixture, plain enum test
def test_sea_html_enum_value():
    assert DocumentFormat.SEA_HTML == "sea_html"

def test_sea_html_distinct_from_froala():
    assert DocumentFormat.SEA_HTML != DocumentFormat.FROALA_HTML
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
- ✅ Positive: given content containing `ins data-cid`, `matches()` returns `True`
- ✅ Positive: given content containing `del data-cid`, `matches()` returns `True`
- ✅ Positive: given content containing `data-author-id`, `matches()` returns `True`
- ✅ Positive: given content containing `ins data-cid`, `get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: given plain `<p>text</p>` with no ICE markers, `matches()` returns `False`
- ❌ Negative: given Froala-only HTML (`fr-element`), `matches()` returns `False`
- ✅ Positive: `extract_fingerprint_hash()` returns `"no-image"` for HTML with no identifiable image

**Test scaffold:**
```python
# Setup: no fixture needed
from data_migrator.detectors.sea.sea_format_detector import SeaFormatDetector
from data_migrator.schemas.models.fingerprint import DocumentFormat

SEA_HTML = '<ins data-cid="1" data-author-id="user1">added text</ins>'
PLAIN_HTML = "<p>regular text</p>"
FROALA_HTML = '<div class="fr-element">text</div>'

def test_matches_sea_markers():
    detector = SeaFormatDetector(SEA_HTML)
    assert detector.matches() is True

def test_does_not_match_plain_html():
    detector = SeaFormatDetector(PLAIN_HTML)
    assert detector.matches() is False

def test_get_format_returns_sea_html():
    detector = SeaFormatDetector(SEA_HTML)
    assert detector.get_format() == DocumentFormat.SEA_HTML
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

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Register SeaFormatDetector in FormatDetectorStrategy.create_default()

**Files:**
- Modify: `src/data_migrator/detectors/format_detector_strategy.py`
- Modify: `tests/unit/detectors/test_format_detector_strategy.py`

**Test cases:**
- ✅ Positive: `FormatDetectorStrategy.create_default().list_detectors()` contains `"sea_contracts"`
- ✅ Positive: given SEA HTML (`ins data-cid`), `strategy.detect(content).get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: given Froala HTML (`fr-element`), `strategy.detect(content).get_format()` returns `DocumentFormat.FROALA_HTML`

**Test scaffold:**
```python
# Setup: no fixture
SEA_CONTENT = '<ins data-cid="1">text</ins>'

def test_create_default_includes_sea():
    strategy = FormatDetectorStrategy.create_default()
    assert "sea_contracts" in strategy.list_detectors()

def test_detects_sea_format():
    strategy = FormatDetectorStrategy.create_default()
    detector = strategy.detect(SEA_CONTENT)
    assert detector.get_format() == DocumentFormat.SEA_HTML
```

**Implementation:**
Add to `create_default()`:
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
- ✅ Positive: given `DocumentFormat.FROALA_HTML`, `resolve()` returns `"froala"`
- ✅ Positive: given `DocumentFormat.SEA_HTML`, `resolve()` returns `"sea_contracts"`
- ✅ Positive: `FormatParserResolver.create_default()` returns a resolver that handles both known formats
- ❌ Negative: given `DocumentFormat.UNKNOWN`, `resolve()` raises `ParserNotFoundError` with format value in message

**Test scaffold:**
```python
# Setup: no fixture
from data_migrator.processors.format_parser_resolver import FormatParserResolver
from data_migrator.schemas.models.fingerprint import DocumentFormat
from data_migrator.exceptions import ParserNotFoundError
import pytest

def test_resolve_froala():
    resolver = FormatParserResolver.create_default()
    assert resolver.resolve(DocumentFormat.FROALA_HTML) == "froala"

def test_resolve_sea():
    resolver = FormatParserResolver.create_default()
    assert resolver.resolve(DocumentFormat.SEA_HTML) == "sea_contracts"

def test_resolve_unknown_raises():
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
            ParserNotFoundError: If no parser is registered for the format.
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
- ✅ Positive: given `parser_name="auto"` and Froala content, `parse_content()` parses with `"froala"` parser (check `result.metadata.parser == "FroalaParser"`)
- ✅ Positive: given `parser_name="auto"` and SEA content (`ins data-cid`), `parse_content()` parses with `"sea_contracts"` parser (check `result.metadata.parser == "SeaContractsParser"`)
- ✅ Positive: given explicit `parser_name="froala"`, no auto-detection happens (existing behavior preserved)
- ❌ Negative: given `parser_name="auto"` and unrecognized HTML (no markers), raises `FormatDetectionError`

**Test scaffold:**
```python
# Setup: no fixture, use SourceDocumentParser directly with real parsers
from data_migrator.services.source_parsing.source_document_parser import SourceDocumentParser
from data_migrator.exceptions import FormatDetectionError
import pytest

FROALA_CONTENT = '<div class="fr-element fr-view"><p>text</p></div>'
SEA_CONTENT = '<ins data-cid="1" data-author-id="u1">added</ins>'
UNKNOWN_CONTENT = "<p>plain text no markers</p>"

def test_auto_selects_froala():
    parser = SourceDocumentParser()
    result = parser.parse_content(FROALA_CONTENT, parser_name="auto", encoding="utf-8")
    assert result.metadata.parser == "FroalaParser"

def test_auto_selects_sea():
    parser = SourceDocumentParser()
    result = parser.parse_content(SEA_CONTENT, parser_name="auto", encoding="utf-8")
    assert result.metadata.parser == "SeaContractsParser"

def test_auto_unknown_raises():
    parser = SourceDocumentParser()
    with pytest.raises(FormatDetectionError):
        parser.parse_content(UNKNOWN_CONTENT, parser_name="auto", encoding="utf-8")
```

**Implementation:**

Add optional parameters to `SourceDocumentParser.__init__()` and logic to `parse_content()`:

```python
# src/data_migrator/services/source_parsing/source_document_parser.py
from data_migrator.processors.format_parser_resolver import FormatParserResolver
from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy

class SourceDocumentParser:
    def __init__(
        self,
        tokenizer_strategy: TokenizerStrategy | None = None,
        format_detector_strategy: FormatDetectorStrategy | None = None,
        format_parser_resolver: FormatParserResolver | None = None,
    ) -> None:
        self.tokenizer_strategy = tokenizer_strategy or TokenizerStrategy.create_default()
        self._format_detector_strategy = format_detector_strategy or FormatDetectorStrategy.create_default()
        self._format_parser_resolver = format_parser_resolver or FormatParserResolver.create_default()

    def _resolve_parser_name(self, content: str, parser_name: str) -> str:
        if parser_name != "auto":
            return parser_name
        detector = self._format_detector_strategy.detect(content)   # raises FormatDetectionError if none match
        return self._format_parser_resolver.resolve(detector.get_format())

    @timed
    def parse_content(self, content: str, parser_name: str, encoding: str, ...) -> SourceDocument:
        resolved_name = self._resolve_parser_name(content, parser_name)
        parser = self.tokenizer_strategy.get_parser(name=resolved_name, content=content, encoding=encoding)
        return parser.parse(token_filter=token_filter)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 6: Wire FormatParserResolver into DefaultContainer

**Files:**
- Modify: `src/data_migrator/containers/base.py`

**Test cases:**
- ✅ Positive: `container.get_source_document_parser()` returns a `SourceDocumentParser` whose `_format_parser_resolver` resolves `DocumentFormat.FROALA_HTML` to `"froala"`
- ✅ Positive: `container.get_source_document_parser()` returns a `SourceDocumentParser` whose `_format_detector_strategy` includes `"sea_contracts"` detector

**Test scaffold:**
```python
# Setup: DefaultContainer (no mocks needed)
from data_migrator.containers.base import DefaultContainer
from data_migrator.schemas.models.fingerprint import DocumentFormat

def test_container_source_document_parser_has_resolver():
    container = DefaultContainer()
    parser_service = container.get_source_document_parser()
    assert parser_service._format_parser_resolver.resolve(DocumentFormat.FROALA_HTML) == "froala"
    assert parser_service._format_parser_resolver.resolve(DocumentFormat.SEA_HTML) == "sea_contracts"
```

**Implementation:**

Add `_format_parser_resolver` override attribute and getter to `DefaultContainer`, then pass it when constructing `SourceDocumentParser`:

```python
# In DefaultContainer.__init__():
self._format_parser_resolver: FormatParserResolver | None = None

# New getter:
def get_format_parser_resolver(self) -> FormatParserResolver:
    def factory() -> FormatParserResolver:
        if self._format_parser_resolver is not None:
            return self._format_parser_resolver
        from data_migrator.processors.format_parser_resolver import FormatParserResolver
        return FormatParserResolver.create_default()
    return self._get_or_create("format_parser_resolver", factory)

# Update get_source_document_parser():
return SourceDocumentParser(
    format_detector_strategy=self.get_format_detector_strategy(),
    format_parser_resolver=self.get_format_parser_resolver(),
)

# New setter:
def set_format_parser_resolver(self, resolver: FormatParserResolver) -> None:
    with self._lock:
        self._format_parser_resolver = resolver
        self._invalidate_scope()
```

Also add `_format_parser_resolver = None` to `_clear_all_overrides()`.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/detectors/base.py:FormatDetectorInterface` — base class for all detectors (implement `matches()`, `get_format()`, `extract_fingerprint_hash()`)
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — reference implementation to follow exactly
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — register new detector here
- `src/data_migrator/processors/tokenizer_strategy.py:TokenizerStrategy` — existing parser registry (do not change)
- `src/data_migrator/containers/base.py:DefaultContainer` — DI container using `_get_or_create` pattern

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/fingerprint.py` — `DocumentFormat` StrEnum to extend
- `src/data_migrator/schemas/models/detection_result.py` — `DetectionResult` already carries `format`

**Patterns to follow:**
- Detector module layout: `detectors/<name>/__init__.py` + `detectors/<name>/<name>_format_detector.py`
- Marker-based `matches()`: `any(marker in self._content for marker in _MARKERS)`
- `create_default()` classmethod factory on strategy/resolver classes
- Container lazy initialization: `_get_or_create("key", factory)` pattern
- `from __future__ import annotations` + `TYPE_CHECKING` guards in all new files

**Test helpers to use:**
- Plain `pytest` unit tests — no fixtures needed for detector tests
- `DefaultContainer` directly for container wiring tests

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

- HTML containing both Froala and SEA markers (both `fr-element` and `ins data-cid`) — SEA detector should win if registered after Froala (strategy iterates in insertion order)
- Empty string content — `matches()` returns `False` for both detectors
- `FormatParserResolver` constructed with empty `mapping={}` — `resolve()` raises `ParserNotFoundError` for any format
- `parse_content(content, parser_name="auto")` when `FormatDetectorStrategy` raises `FormatDetectionError` — exception propagates unchanged

---

## Success Criteria

**Must have:**
- `DocumentFormat.SEA_HTML` exists with value `"sea_html"`
- `SeaFormatDetector.matches()` returns `True` for SEA ICE/CKEditor HTML
- `FormatDetectorStrategy.create_default()` includes `"sea_contracts"` detector
- `FormatParserResolver.create_default()` maps both `FROALA_HTML → "froala"` and `SEA_HTML → "sea_contracts"`
- `SourceDocumentParser.parse_content(..., parser_name="auto")` auto-selects correct parser
- `DefaultContainer` wires `FormatParserResolver` correctly
- All tests pass
- Static analysis passes
- Coverage meets thresholds

**Nice to have:**
- `import-template` CLI command gains `--parser=auto` support (out of scope for this plan)
- `FormatParserResolver` exposed via `FormatParserResolver.register()` for extensibility

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found in `docs/designs/`

**Memories Referenced:**
- `utility_classes` — confirmed `TokenizerStrategy` and `FormatDetectorStrategy` are the right extension points; `FrozenModel` pattern for any new models
- `architecture_patterns` — not loaded (read code directly instead)

**Similar Implementations:**
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — exact reference for `SeaFormatDetector` structure
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — registration pattern for `create_default()`
- `src/data_migrator/containers/base.py:DefaultContainer.get_format_detector_strategy` — container wiring pattern to follow for `get_format_parser_resolver`
