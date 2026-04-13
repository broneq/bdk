# Plan: Document Format Detector with Auto-Parser Selection

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Add a `SeaContractsFormatDetector`, extend `DocumentFormat` enum, and wire a format→parser-name bridge so callers can auto-select the right parser from raw HTML content.
**Architecture:** New `SeaContractsFormatDetector` under `detectors/sea/`, mirroring `FroalaFormatDetector`. `DocumentFormat` enum gains `SEA_HTML`. `TokenizerStrategy` gains a static `format_to_parser_name()` bridge. `SourceDocumentParser` gains an optional `detect_and_parse()` convenience method.
**Complexity:** LOW

---

## Context

The codebase already has a complete format detection infrastructure:
- `detectors/base.py` — `FormatDetectorInterface` ABC
- `detectors/froala/froala_format_detector.py` — `FroalaFormatDetector` implementation
- `detectors/format_detector_strategy.py` — `FormatDetectorStrategy` registry (mirrors `TokenizerStrategy`)
- `schemas/models/fingerprint.py` — `DocumentFormat` enum (currently only `FROALA_HTML` and `UNKNOWN`)

However, `SeaContractsParser` (registered as `"sea_contracts"` in `TokenizerStrategy`) has no corresponding format detector. Additionally, there is **no bridge** between `DocumentFormat` values and `TokenizerStrategy` parser names — a caller who runs `FormatDetectorStrategy.detect(content)` gets a `DocumentFormat` back, but has no way to translate that to the `parser_name` string required by `TokenizerStrategy.get_parser()`.

This plan fills both gaps:
1. Implement `SeaContractsFormatDetector` that recognises CKEditor+ICE HTML by `ice-ins`/`ice-del`/`del`+`ins` element markers.
2. Add `DocumentFormat.SEA_HTML` to the enum.
3. Register the new detector in `FormatDetectorStrategy.create_default()`.
4. Add `TokenizerStrategy.format_to_parser_name(format)` static bridge method.
5. Add `SourceDocumentParser.detect_and_parse()` that orchestrates detection → parser selection → parse in one call.

Sea Contracts HTML is identified by ICE track-change elements: `<ins class="ice-ins ...">` and `<del class="ice-del ...">`. See `processors/tokenizers/sea/core/change_type_detector.py` lines 37–43.

---

## Explored Approaches

### Approach 1: SeaDetector + Static Bridge in TokenizerStrategy (Selected)

**Description:** Add `SeaContractsFormatDetector` following the exact same pattern as `FroalaFormatDetector`. Extend the `DocumentFormat` enum. Add `format_to_parser_name()` as a static method on `TokenizerStrategy`. Add `detect_and_parse()` on `SourceDocumentParser`. No new classes required.

**Pros:**
- Follows all existing patterns exactly (mirrors `FroalaFormatDetector`)
- Minimal surface area — two new files, three small modifications
- SRP preserved — each class retains single responsibility

**Cons:**
- `TokenizerStrategy.format_to_parser_name()` is a mapping that must be manually kept in sync when new parsers are added

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

---

### Approach 2: Format-Parser Registry Inside TokenizerStrategy (Not Selected)

**Description:** Store a `dict[DocumentFormat, str]` inside `TokenizerStrategy` and extend `register_tokenizer()` to accept an optional `document_format`. `create_default()` passes `DocumentFormat.FROALA_HTML` and `DocumentFormat.SEA_HTML` when registering.

**Pros / Cons:** Colocates parser name and format mapping; but changes `register_tokenizer()` signature and couples `TokenizerStrategy` to `DocumentFormat` (cross-layer dependency: processor layer → schema layer).

**Why not selected:** Violates layer separation. `TokenizerStrategy` would import `DocumentFormat` from `schemas/models/` — a schema coupling that doesn't exist today and is against the dependency rule.

---

### Approach 3: New `FormatAwareParserSelector` Service (Not Selected)

**Description:** New service class that composes `FormatDetectorStrategy` and `TokenizerStrategy`, exposing `select_parser(content)` directly.

**Why not selected:** Over-engineering for what is essentially a 3-line mapping. Adds an unnecessary class, increases DI container surface, complicates tests.

---

## Selected Approach: SeaDetector + Static Bridge in TokenizerStrategy

**Rationale:** Lowest complexity, perfectly mirrors existing patterns, no layer violations. The `format_to_parser_name()` static method on `TokenizerStrategy` is the minimal change needed to close the format→parser gap without coupling layers inappropriately.

---

## Implementation Tasks

### Task 1: Extend `DocumentFormat` enum with `SEA_HTML`

**Files:**
- Modify: `src/data_migrator/schemas/models/fingerprint.py`
- Test: `tests/unit/schemas/` (quick inline assertion in detector tests is sufficient)

**Test cases:**
- ✅ Positive: `DocumentFormat.SEA_HTML` has value `"sea_html"`
- ✅ Positive: `DocumentFormat.FROALA_HTML` still exists (regression check)

**Implementation:**

```python
class DocumentFormat(StrEnum):
    FROALA_HTML = "froala_html"
    SEA_HTML = "sea_html"
    UNKNOWN = "unknown"
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Create `SeaContractsFormatDetector`

**Files:**
- Create: `src/data_migrator/detectors/sea/__init__.py`
- Create: `src/data_migrator/detectors/sea/sea_contracts_format_detector.py`
- Create: `tests/unit/detectors/sea/__init__.py`
- Create: `tests/unit/detectors/sea/test_sea_contracts_format_detector.py`

**Test cases:**
- ✅ Positive: HTML with `ice-ins` class → `matches()` returns `True`
- ✅ Positive: HTML with `ice-del` class → `matches()` returns `True`
- ✅ Positive: `get_format()` returns `DocumentFormat.SEA_HTML`
- ✅ Positive: `extract_fingerprint_hash()` returns `"no-image"` (Sea Contracts has no embedded image)
- ❌ Negative: Froala HTML (fr-element) → `matches()` returns `False`
- ❌ Negative: empty string → `matches()` returns `False`

**Implementation:**

```python
# src/data_migrator/detectors/sea/sea_contracts_format_detector.py
from __future__ import annotations

import structlog

from data_migrator.detectors.base import FormatDetectorInterface
from data_migrator.schemas.models.fingerprint import DocumentFormat

logger = structlog.get_logger(__name__)

_SEA_MARKERS = frozenset(("ice-ins", "ice-del"))


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

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Register `SeaContractsFormatDetector` in `FormatDetectorStrategy.create_default()`

**Files:**
- Modify: `src/data_migrator/detectors/format_detector_strategy.py`
- Modify: `tests/unit/detectors/test_format_detector_strategy.py`

**Test cases:**
- ✅ Positive: `FormatDetectorStrategy.create_default().list_detectors()` contains `"sea_contracts"`
- ✅ Positive: Sea Contracts HTML → `detect()` returns detector with `get_format() == DocumentFormat.SEA_HTML`
- ✅ Positive: Froala HTML still detected as `DocumentFormat.FROALA_HTML` (regression)
- ❌ Negative: unknown HTML → `detect()` still raises `FormatDetectionError`

**Implementation:**

Modify `FormatDetectorStrategy.create_default()`:

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

Sea Contracts HTML fixture for tests:
```python
SEA_HTML = '<div><ins class="ice-ins ice-cts-1">added text</ins></div>'
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
- ❌ Negative: `TokenizerStrategy.format_to_parser_name(DocumentFormat.UNKNOWN)` raises `ParserNotFoundError`

**Implementation:**

Add to `TokenizerStrategy` (after `list_tokenizers`):

```python
_FORMAT_TO_PARSER: dict[str, str] = {
    "froala_html": "froala",
    "sea_html": "sea_contracts",
}

@staticmethod
def format_to_parser_name(document_format: DocumentFormat) -> str:
    """Map DocumentFormat to registered parser name.

    Raises:
        ParserNotFoundError: If no parser is registered for this format.
    """
    from data_migrator.schemas.models.fingerprint import DocumentFormat as DF

    name = TokenizerStrategy._FORMAT_TO_PARSER.get(document_format.value)
    if name is None:
        raise ParserNotFoundError(
            f"No parser registered for format '{document_format.value}'"
        )
    return name
```

Note: `_FORMAT_TO_PARSER` uses `.value` strings to avoid a module-level import of `DocumentFormat` in `processors/` layer. The import is deferred inside the method.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 5: Add `detect_and_parse()` to `SourceDocumentParser`

**Files:**
- Modify: `src/data_migrator/services/source_parsing/source_document_parser.py`
- Create or modify: `tests/unit/services/source_parsing/test_source_document_parser.py`

**Test cases:**
- ✅ Positive: Froala HTML auto-detects and parses (mock `FormatDetectorStrategy` + `TokenizerStrategy`)
- ✅ Positive: Sea Contracts HTML auto-detects and parses
- ❌ Negative: Unknown HTML → `FormatDetectionError` propagates
- ❌ Negative: No `format_detector_strategy` set → raises `ValueError`

**Implementation:**

Add to `SourceDocumentParser.__init__`:
```python
def __init__(
    self,
    tokenizer_strategy: TokenizerStrategy | None = None,
    format_detector_strategy: FormatDetectorStrategy | None = None,
) -> None:
    self.tokenizer_strategy = tokenizer_strategy or TokenizerStrategy.create_default()
    self._format_detector_strategy = format_detector_strategy
```

Add new method:
```python
def detect_and_parse(
    self,
    content: str,
    encoding: str = "utf-8",
    token_filter: TokenFilter | None = None,
) -> SourceDocument:
    """Auto-detect format and parse content.

    Raises:
        FormatDetectionError: If content format cannot be detected.
        ValueError: If no format_detector_strategy was provided.
    """
    if self._format_detector_strategy is None:
        from data_migrator.detectors.format_detector_strategy import FormatDetectorStrategy
        self._format_detector_strategy = FormatDetectorStrategy.create_default()

    detector = self._format_detector_strategy.detect(content)
    parser_name = TokenizerStrategy.format_to_parser_name(detector.get_format())
    logger.debug("auto_detected_parser", parser_name=parser_name)
    return self.parse_content(
        content=content,
        parser_name=parser_name,
        encoding=encoding,
        token_filter=token_filter,
    )
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `detectors/froala/froala_format_detector.py:FroalaFormatDetector` — exact structural template for `SeaContractsFormatDetector`
- `detectors/base.py:FormatDetectorInterface` — ABC for all detectors
- `processors/tokenizer_strategy.py:TokenizerStrategy` — extended with bridge method
- `exceptions.py:FormatDetectionError` — reuse for unknown format errors
- `exceptions.py:ParserNotFoundError` — reuse in `format_to_parser_name()`

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/fingerprint.py` — `DocumentFormat` enum extended here

**Patterns to follow:**
- `_FROALA_MARKERS = frozenset(...)` → `_SEA_MARKERS = frozenset(...)` constant pattern
- Deferred imports in `create_default()` factory methods (lazy-import pattern used in all strategy classes)
- `structlog.get_logger(__name__)` for module-level logger

**Test helpers to use:**
- Direct pytest class-based tests (no special helpers needed for detector tests)

---

## Verification

### Code Quality

Delegate to `static-analyse` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/detectors/ tests/unit/processors/test_tokenizer_strategy.py tests/unit/services/source_parsing/ -v --cov=src/data_migrator/detectors --cov=src/data_migrator/processors/tokenizer_strategy --cov=src/data_migrator/services/source_parsing
Coverage targets:
  - Critical paths: >90%
  - Business logic: >85%
```

### Edge Cases to Test

- HTML with both `ice-ins` and `fr-element` markers (Froala takes precedence as it's registered first)
- `DocumentFormat.UNKNOWN` → `format_to_parser_name()` raises `ParserNotFoundError`
- `detect_and_parse()` with `format_detector_strategy=None` falls back to `create_default()`

---

## Success Criteria

**Must have:**
- `SeaContractsFormatDetector.matches()` correctly identifies ICE-marked HTML
- `FormatDetectorStrategy.create_default()` lists both `"froala"` and `"sea_contracts"` detectors
- `TokenizerStrategy.format_to_parser_name(DocumentFormat.SEA_HTML)` returns `"sea_contracts"`
- `SourceDocumentParser.detect_and_parse()` completes full auto-detection→parse flow
- All existing tests pass (no regressions to `FroalaFormatDetector`, `FormatDetectorStrategy`, `TokenizerStrategy`)
- Static analysis passes

**Nice to have:**
- Integration test: full `detect_and_parse()` round-trip with fixture Sea Contracts HTML

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found in `docs/designs/`

**Memories Referenced:**
- `project_overview` — architecture layers, parser strategy pattern
- `utility_classes` — `TokenizerStrategy` and `FormatDetectorStrategy` patterns
- `architecture_patterns` — layer separation rules, SOLID principles

**Similar Implementations:**
- `src/data_migrator/detectors/froala/froala_format_detector.py:FroalaFormatDetector` — serves as structural template for `SeaContractsFormatDetector`
- `src/data_migrator/processors/tokenizer_strategy.py:TokenizerStrategy` — extended with static bridge
- `src/data_migrator/detectors/format_detector_strategy.py:FormatDetectorStrategy` — registry pattern being extended
