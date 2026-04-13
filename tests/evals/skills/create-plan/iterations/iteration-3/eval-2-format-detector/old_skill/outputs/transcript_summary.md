# Transcript Summary: create-plan for Document Format Detector

## Task
Implement a new document format detector that identifies document type from HTML structure and auto-selects the right parser. Register it in the existing parser selection mechanism.

## Skill Execution

### Phase 1: Parse & Setup
- Input validated as specific enough (>10 words, concrete feature)
- Slug: `document-format-detector-parser-selection`
- Plan path: `docs/plans/2026-03-24-document-format-detector-parser-selection.md`
- Two related plans already existed (`document-format-detector.md`, `document-format-detector-parser.md`); new plan created with unique slug
- No design docs found in `docs/designs/`

### Phase 2: Exploration (3 agents)
Explored in parallel using Serena tools + direct file reads:

**Agent 1 — Utilities & Existing Implementations:**
- `FormatDetectorInterface` ABC (detectors/base.py): `__init__(content)`, `matches()`, `get_format()`, `extract_fingerprint_hash()`
- `FormatDetectorStrategy` (detectors/format_detector_strategy.py): `create_default()` only registers Froala; `detect()`, `list_detectors()`
- `FroalaFormatDetector` (detectors/froala/): uses `_FROALA_MARKERS` tuple + string scan; extends `FormatDetectorInterface`
- `DocumentFormat` StrEnum: only `FROALA_HTML` and `UNKNOWN` — `SEA_HTML` missing
- `TokenizerStrategy` (processors/): registers both `froala` and `sea_contracts` parsers; no format→name bridge
- `SourceDocumentParser` (services/source_parsing/): `parse_content()` and `parse_file()` both require explicit `parser_name`

**Agent 2 — Architecture & Dependencies:**
- Affected layers: Detectors, Schemas/Models, Processors, Services/source_parsing
- `DocumentFormatDetectionService` exists in services/detection/ — uses `FormatDetectorStrategy.detect()` then `get_format()` + fingerprint
- `DetectDocumentFormatUseCase` exists — uses `DocumentFormatDetectionService.detect()` but focuses on fingerprint matching, not parser selection
- Container (`containers/base.py`) already wires `FormatDetectorStrategy` and `SourceDocumentParser` independently — no format→parser bridge anywhere
- CLI `import-template` requires explicit `--parser` flag; `migrate` resolves parser from template metadata

**Agent 3 — Similar Features:**
- `FroalaFormatDetector` is the exact structural template: string-scan `matches()`, single-line `get_format()`, `extract_fingerprint_hash()` returning `"no-image"` when no image
- ICE markers `ice-ins`/`ice-del` confirmed in `processors/tokenizers/sea/core/change_type_detector.py`
- `SeaContractsParser` registered as `"sea_contracts"` in `TokenizerStrategy.create_default()`
- Existing tests: `test_froala_format_detector.py`, `test_format_detector_strategy.py`, `test_tokenizer_strategy.py`, `test_source_document_parser.py`

### Phase 3: Design & Decisions
Three approaches analyzed:
1. **SeaDetector + Static Bridge in TokenizerStrategy** (Selected) — mirrors FroalaFormatDetector, adds `_FORMAT_TO_PARSER` dict + static `format_to_parser_name()`, adds `detect_and_parse()` — LOW complexity, LOW risk
2. **FormatAwareParserSelector New Service** (Rejected) — over-engineering, adds unnecessary class, grows DI surface
3. **Auto-detect CLI Flag** (Rejected) — layer violation, business logic in presentation layer

No user questions needed — clear path forward.

### Phase 4: Plan Written
5 implementation tasks (TDD cycle each):
1. Extend `DocumentFormat` enum with `SEA_HTML`
2. Create `SeaContractsFormatDetector` with tests
3. Register detector in `FormatDetectorStrategy.create_default()`
4. Add `TokenizerStrategy.format_to_parser_name()` static bridge
5. Add `SourceDocumentParser.detect_and_parse()` method

Files: 3 to create, 4 to modify, test files for each task.

### Phase 5: Summary
Plan written to: `docs/plans/2026-03-24-document-format-detector-parser-selection.md`

## Key Findings
- No `SeaContractsFormatDetector` exists yet — the codebase has the ICE markers identified in `change_type_detector.py` but no detector class
- `DocumentFormat` enum is missing `SEA_HTML` value
- No format→parser-name bridge anywhere in the codebase
- `SourceDocumentParser` has no auto-detect method
- All infrastructure for the detector pattern exists and is well-tested — implementation is straightforward mirroring
