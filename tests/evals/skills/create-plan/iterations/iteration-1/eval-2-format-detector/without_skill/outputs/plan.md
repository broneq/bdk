# Plan: Document Format Detector for SEA Contracts

**Date:** 2026-03-24
**Branch:** poc/sea-contracts-parser
**Goal:** Implement a `SeaContractsFormatDetector` that identifies SEA Contracts HTML (CKEditor + ICE/CPM) from HTML structure, add `DocumentFormat.SEA_CONTRACTS_HTML` to the enum, and register it in `FormatDetectorStrategy.create_default()`.

---

## Background

The codebase already has a partial detection pipeline:

| Component | Path | Status |
|-----------|------|--------|
| `FormatDetectorInterface` (ABC) | `detectors/base.py` | Done |
| `FormatDetectorStrategy` | `detectors/format_detector_strategy.py` | Done — only Froala registered |
| `FroalaFormatDetector` | `detectors/froala/froala_format_detector.py` | Done |
| `DocumentFormat` enum | `schemas/models/fingerprint.py` | Has `FROALA_HTML` + `UNKNOWN`, missing `SEA_CONTRACTS_HTML` |
| `SeaContractsParser` tokenizer | `processors/tokenizers/sea/sea_parser.py` | Done |
| `TokenizerStrategy` | `processors/tokenizer_strategy.py` | Registers `sea_contracts` key |

**Gap:** No `SeaContractsFormatDetector` exists. When an HTML document arrives from a SEA Contracts export it falls through the strategy and raises `FormatDetectionError`.

---

## SEA Contracts HTML Markers

From `SeaChangeTypeDetector` the identifying markers are:

- `<ins class="ice-ins ...">` — tracked insertion
- `<del class="ice-del ...">` — tracked deletion
- Elements with class `cpm-change-previous-ins` — CPM previous insertion marker

These markers are unique to the CKEditor + ICE/CPM toolchain. None overlap with Froala markers (`fr-element`, `fr-tracking-deleted`, `fr-highlight-change`).

A fast string-scan (same approach as `FroalaFormatDetector.matches()`) is sufficient — no full BeautifulSoup parse needed.

---

## Implementation Steps

### Step 1 — Add `SEA_CONTRACTS_HTML` to `DocumentFormat`

**File:** `src/data_migrator/schemas/models/fingerprint.py`

Add `SEA_CONTRACTS_HTML = "sea_contracts_html"` to the `DocumentFormat` StrEnum.

```python
class DocumentFormat(StrEnum):
    FROALA_HTML = "froala_html"
    SEA_CONTRACTS_HTML = "sea_contracts_html"   # new
    UNKNOWN = "unknown"
```

No other changes needed in this file.

---

### Step 2 — Create `SeaContractsFormatDetector`

**New file:** `src/data_migrator/detectors/sea/__init__.py` (empty)

**New file:** `src/data_migrator/detectors/sea/sea_format_detector.py`

```python
from __future__ import annotations

from data_migrator.detectors.base import FormatDetectorInterface
from data_migrator.schemas.models.fingerprint import DocumentFormat

_SEA_MARKERS = ("ice-ins", "ice-del", "cpm-change-previous-ins")


class SeaContractsFormatDetector(FormatDetectorInterface):
    def matches(self) -> bool:
        return any(marker in self._content for marker in _SEA_MARKERS)

    def get_format(self) -> DocumentFormat:
        return DocumentFormat.SEA_CONTRACTS_HTML

    def extract_fingerprint_hash(self) -> str | None:
        # Sea Contracts HTML has no embedded fingerprint image.
        # Return "no-image" to signal "format detected, but no template match possible via hash".
        return "no-image"
```

**Design notes:**
- `matches()` uses the same fast substring scan as `FroalaFormatDetector` — O(n) per marker, no DOM parsing.
- `extract_fingerprint_hash()` returns `"no-image"` (same sentinel as Froala when image is absent). This causes `DocumentFormatDetectionService.detect()` to reach `find_by_hash("no-image")` — unless a fingerprint entry with that hash exists, it returns `detected=False`. This is intentional: SEA documents are not template-matched by image hash; the template name must be supplied explicitly (e.g., via `--name` CLI flag).
- No `BeautifulSoup` import needed; keeps the detector lightweight.

---

### Step 3 — Register in `FormatDetectorStrategy.create_default()`

**File:** `src/data_migrator/detectors/format_detector_strategy.py`

In `create_default()`, after registering `"froala"`, register `"sea_contracts"`:

```python
@classmethod
def create_default(cls) -> FormatDetectorStrategy:
    from data_migrator.detectors.froala.froala_format_detector import FroalaFormatDetector
    from data_migrator.detectors.sea.sea_format_detector import SeaContractsFormatDetector

    strategy = cls()
    strategy.register_detector("froala", FroalaFormatDetector)
    strategy.register_detector("sea_contracts", SeaContractsFormatDetector)
    return strategy
```

The `_detectors` dict is an insertion-ordered `dict`. Froala is checked first. A document cannot simultaneously contain Froala markers and SEA ICE markers (different editors), so order is not ambiguous — but keeping Froala first preserves backward-compatible behaviour.

---

### Step 4 — Unit Tests

#### 4a — Detector unit test

**New file:** `tests/unit/detectors/sea/__init__.py` (empty)

**New file:** `tests/unit/detectors/sea/test_sea_format_detector.py`

Test cases:
- `test_matches_ice_ins_marker` — content with `ice-ins` → `matches()` is True
- `test_matches_ice_del_marker` — content with `ice-del` → True
- `test_matches_cpm_marker` — content with `cpm-change-previous-ins` → True
- `test_no_match_plain_html` — plain HTML without markers → False
- `test_no_match_froala_html` — Froala-only content → False
- `test_get_format` — returns `DocumentFormat.SEA_CONTRACTS_HTML`
- `test_extract_fingerprint_hash_returns_no_image` — returns `"no-image"`

#### 4b — Strategy integration test update

**File:** `tests/unit/detectors/test_format_detector_strategy.py`

Add:
- `test_create_default_registers_sea_contracts` — `"sea_contracts"` in `strategy.list_detectors()`
- `test_detect_sea_contracts` — strategy detects SEA HTML and returns `DocumentFormat.SEA_CONTRACTS_HTML`

---

## Files Changed / Created

| Action | Path |
|--------|------|
| MODIFY | `src/data_migrator/schemas/models/fingerprint.py` |
| CREATE | `src/data_migrator/detectors/sea/__init__.py` |
| CREATE | `src/data_migrator/detectors/sea/sea_format_detector.py` |
| MODIFY | `src/data_migrator/detectors/format_detector_strategy.py` |
| CREATE | `tests/unit/detectors/sea/__init__.py` |
| CREATE | `tests/unit/detectors/sea/test_sea_format_detector.py` |
| MODIFY | `tests/unit/detectors/test_format_detector_strategy.py` |

---

## What Is NOT in Scope

- Template-hash fingerprinting for SEA documents (they use no embedded image). The existing `FingerprintFileRepository` / `FingerprintIndex` machinery is unchanged.
- Auto-selection of `parser_name` from detected format in `MigrateDocumentUseCase`. That use case already reads `parser_name` from `TemplateDiffsStorage.metadata.parser_name` (set at import time). The detect endpoint is a separate flow (template identification, not migration).
- Changes to `DocumentFormatDetectionService` or `DetectDocumentFormatUseCase` — the detection service calls `detector.get_format()` + `detector.extract_fingerprint_hash()` which both have correct implementations.
- API route changes — `/detect` endpoint already uses `container.get_detect_document_format_use_case()` which will pick up the new detector automatically via `FormatDetectorStrategy.create_default()`.

---

## Acceptance Criteria

- [ ] `FormatDetectorStrategy.create_default()` lists `"sea_contracts"` in `list_detectors()`
- [ ] SEA Contracts HTML (`ice-ins`, `ice-del`, `cpm-change-previous-ins`) triggers `SeaContractsFormatDetector.matches() == True`
- [ ] `get_format()` returns `DocumentFormat.SEA_CONTRACTS_HTML`
- [ ] Froala HTML still detects as `DocumentFormat.FROALA_HTML` (no regression)
- [ ] Plain HTML still raises `FormatDetectionError` (no regression)
- [ ] All new unit tests pass
- [ ] `ruff check` + `mypy --strict` pass
- [ ] `bin/cleanup.sh` MI ≥ A, CC ≤ B

---

## Risk Assessment

**Low risk.**
- The change is purely additive: new enum value, new detector class, one `register_detector()` call.
- No existing code paths are modified except the `create_default()` factory.
- `FormatDetectorStrategy.detect()` is unchanged; it iterates registered detectors and returns the first match — SEA documents currently raise `FormatDetectionError`, so adding a matching detector can only improve outcomes, not break them.
- The `UNKNOWN` enum value and `FormatDetectionError` path are preserved for truly unrecognised content.
