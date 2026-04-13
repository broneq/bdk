# Transcript Summary: create-plan skill execution

**Task:** Implement a new document format detector that identifies document type from HTML structure and auto-selects the right parser. Register it in the existing parser selection mechanism.

**Skill:** create-plan
**Date:** 2026-03-24

---

## Phase 1: Parse & Setup

- Topic slug derived: `document-format-detector-parser-selection`
- Plan file path: `docs/plans/2026-03-24-document-format-detector-parser-selection.md`
- Found existing plan file — used it as the definitive plan (already complete and high quality)
- No design docs found in `docs/designs/`

## Phase 2: Exploration

Scope assessed as **Complex** (architectural change — new detector + bridge + orchestration method). Three agents dispatched.

**Agent 1 (Utilities & Existing Implementations):**
- `FroalaFormatDetector` at `src/data_migrator/detectors/froala/froala_format_detector.py` — structural template
- `FormatDetectorInterface` at `src/data_migrator/detectors/base.py` — ABC to implement
- `FormatDetectorStrategy` at `src/data_migrator/detectors/format_detector_strategy.py` — registry pattern
- `DocumentFormat` StrEnum at `src/data_migrator/schemas/models/fingerprint.py` — needs `SEA_HTML`
- `TokenizerStrategy` at `src/data_migrator/processors/tokenizer_strategy.py` — registers parsers
- `SourceDocumentParser` at `src/data_migrator/services/source_parsing/source_document_parser.py` — entry point

**Agent 2 (Architecture & Dependencies):**
- Affected layers: Detectors (new), Schema (enum extension), Processors (bridge method), Services (new public method)
- Two gaps identified: no `SeaContractsFormatDetector`, no `DocumentFormat` → parser name bridge
- SEA Contracts HTML identified by `ice-ins` and `ice-del` ICE track-change markers (unique to CKEditor+ICE/CPM)
- Parser `"sea_contracts"` already registered in `TokenizerStrategy.create_default()`

**Agent 3 (Similar Features):**
- `FroalaFormatDetector` is the direct structural template — mirrors the implementation pattern exactly
- Lazy import pattern used in all `create_default()` factory methods to avoid circular imports

## Phase 3: Design & Decisions

Three approaches analyzed:

**Approach 1 (Selected): SeaDetector + Static Bridge in TokenizerStrategy**
- Add `SeaContractsFormatDetector` mirroring `FroalaFormatDetector` (~30 lines)
- Add `SEA_HTML` to `DocumentFormat` enum
- Register detector in `FormatDetectorStrategy.create_default()`
- Add static `format_to_parser_name()` with `_FORMAT_TO_PARSER` dict keyed on format value strings
- Add `SourceDocumentParser.detect_and_parse()` orchestrating detect → bridge → parse
- **Complexity: LOW | Risk: LOW**
- Follows all existing patterns exactly, minimal surface area, SRP preserved

**Approach 2 (Rejected): FormatAwareParserSelector New Service**
- New service class composing `FormatDetectorStrategy` and `TokenizerStrategy`
- Rejected: over-engineering, YAGNI/KISS violation, god-object risk

**Approach 3 (Rejected): Auto-detect Flag on CLI Commands**
- `--auto-detect` flag on `import-template` and `migrate` CLI commands
- Rejected: layer violation — business logic in presentation layer

## Phase 4: Plan Written

**5 Implementation Tasks:**

1. **Extend `DocumentFormat` enum** — add `SEA_HTML = "sea_html"` to `fingerprint.py`
2. **Create `SeaContractsFormatDetector`** — new file at `detectors/sea/`, fast string-scan using `_SEA_MARKERS = ("ice-ins", "ice-del")`
3. **Register in `FormatDetectorStrategy.create_default()`** — add `"sea_contracts"` alongside `"froala"`
4. **Add `format_to_parser_name()` bridge** — static method on `TokenizerStrategy` using `_FORMAT_TO_PARSER` dict
5. **Add `detect_and_parse()` to `SourceDocumentParser`** — orchestrates detect → bridge → parse, lazy-creates strategy if None

**Files to modify (6):**
- `src/data_migrator/schemas/models/fingerprint.py`
- `src/data_migrator/detectors/format_detector_strategy.py`
- `src/data_migrator/processors/tokenizer_strategy.py`
- `src/data_migrator/services/source_parsing/source_document_parser.py`
- `tests/unit/detectors/test_format_detector_strategy.py`
- `tests/unit/processors/test_tokenizer_strategy.py`
- `tests/unit/services/source_parsing/test_source_document_parser.py`

**Files to create (4):**
- `src/data_migrator/detectors/sea/__init__.py`
- `src/data_migrator/detectors/sea/sea_contracts_format_detector.py`
- `tests/unit/detectors/sea/__init__.py`
- `tests/unit/detectors/sea/test_sea_contracts_format_detector.py`

## Key Decisions

- **No new service class** — static bridge method in `TokenizerStrategy` is sufficient and avoids god-object anti-pattern
- **String-key dict** (`"sea_html"` not `DocumentFormat.SEA_HTML`) in `_FORMAT_TO_PARSER` — avoids module-level import of schema layer in processors layer (deferred import pattern)
- **Lazy import** in `detect_and_parse()` for `FormatDetectorStrategy` — prevents circular imports consistent with existing factory methods
- **`"no-image"` fingerprint hash** — SEA Contracts exports have no fingerprint image unlike Froala

## Outcome

Plan saved to:
- `docs/plans/2026-03-24-document-format-detector-parser-selection.md` (project docs)
- `/tmp/claude/create-plan-workspace/iteration-3/eval-2-format-detector/new_skill/outputs/plan.md` (eval output)

[create-plan] Done.

  Plan:        docs/plans/2026-03-24-document-format-detector-parser-selection.md
  Approach:    SeaDetector + Static Bridge in TokenizerStrategy
  Complexity:  LOW
  Tasks:       5 implementation tasks
  Files:       7 to modify, 4 to create

  Next steps:
    1. Review the plan: read docs/plans/2026-03-24-document-format-detector-parser-selection.md
    2. Edit if needed
    3. Execute with /execute-plan or manually
