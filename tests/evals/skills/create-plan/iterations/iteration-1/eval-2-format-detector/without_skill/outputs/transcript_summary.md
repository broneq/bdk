# Transcript Summary

## Task
Create an implementation plan for a document format detector that identifies document type from HTML structure and auto-selects the right parser. Register it in the existing parser selection mechanism.

## Exploration Steps

1. Searched for parser/detector/tokenizer files to map the existing architecture.
2. Read `detectors/base.py` — found `FormatDetectorInterface` ABC with `matches()`, `get_format()`, `extract_fingerprint_hash()`.
3. Read `detectors/format_detector_strategy.py` — found `FormatDetectorStrategy` with `create_default()` (only `FroalaFormatDetector` registered), `register_detector()`, `detect()`.
4. Read `detectors/froala/froala_format_detector.py` — fast string-scan pattern for marker detection confirmed.
5. Read `schemas/models/fingerprint.py` — `DocumentFormat` enum has `FROALA_HTML` and `UNKNOWN`; `SEA_CONTRACTS_HTML` is missing.
6. Read `processors/tokenizers/sea/sea_parser.py` and `core/change_type_detector.py` — identified `ice-ins`, `ice-del`, `cpm-change-previous-ins` as the SEA Contracts HTML markers.
7. Read `processors/tokenizer_strategy.py` — `sea_contracts` is already registered as a tokenizer; the format detector side is the gap.
8. Read `services/detection/document_format_detection_service.py` and `use_cases/detect_document_format.py` — these are format-agnostic and require no changes.
9. Read `containers/base.py` — DI wiring for `FormatDetectorStrategy` confirmed; `create_default()` is the single registration point.
10. Reviewed existing tests in `tests/unit/detectors/` to understand test patterns.

## Key Findings

- The detection pipeline (`FormatDetectorInterface` → `FormatDetectorStrategy` → `DocumentFormatDetectionService` → `DetectDocumentFormatUseCase` → API `/detect` route) is fully functional for Froala.
- The gap is precisely: no `SeaContractsFormatDetector` class and no `SEA_CONTRACTS_HTML` enum value.
- SEA Contracts HTML is produced by CKEditor + ICE/CPM; its markers (`ice-ins`, `ice-del`, `cpm-change-previous-ins`) are unique and non-overlapping with Froala markers.
- `extract_fingerprint_hash()` should return `"no-image"` for SEA (no embedded fingerprint image), matching the Froala fallback convention. Template matching via hash is not applicable for SEA documents.
- The change is purely additive — 2 new files, 5 modified/created — with no risk to existing flows.

## Outcome

Plan written to:
- `docs/plans/2026-03-24-document-format-detector.md` (project plans directory)
- `/tmp/claude/create-plan-workspace/iteration-1/eval-2-format-detector/without_skill/outputs/plan.md` (eval output copy)
