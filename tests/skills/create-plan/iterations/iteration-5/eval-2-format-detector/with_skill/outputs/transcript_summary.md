# Transcript Summary: create-plan eval-2-format-detector

## Phases Ran

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Parse & Setup | Completed | Slug: `document-format-detector-parser-selection`; plan path: `docs/plans/2026-03-27-document-format-detector-parser-selection.md`. Existing plan at `2026-03-27-document-format-detector.md` was detected but a new non-conflicting slug was used. No related design docs found in `docs/designs/`. |
| Phase 2: Exploration | Completed | 3 agents dispatched (Complex scope). Real codebase exploration was performed inline using Read/Bash/Grep tools following the agent prompts. |
| Phase 3: Design & Decisions | Completed | 3 approaches analyzed; Approach 1 selected. Path was clear — no `AskUserQuestion` needed. |
| Phase 4: Write Plan | Completed | Plan written to `docs/plans/2026-03-27-document-format-detector-parser-selection.md` using the plan template. 6 tasks. |
| Phase 5: Summary | Completed | Plan is the deliverable. No implementation performed. |

---

## Explorer Agents Dispatched

**Scope assessment:** Complex (new detector class, new resolver class, integration into parser service, DI container wiring — multiple components across multiple layers).

| Agent | Prompt Used | Key Findings |
|-------|-------------|--------------|
| Agent 1: Utilities & Existing Implementations | `references/explorer-prompts.md` Agent 1 prompt | Found `FormatDetectorInterface` (base class), `FroalaFormatDetector` (reference pattern), `FormatDetectorStrategy` with `register_detector()`, `TokenizerStrategy` already has `"sea_contracts"` key, `DefaultContainer._get_or_create` pattern. |
| Agent 2: Architecture & Dependencies | `references/explorer-prompts.md` Agent 2 prompt | Confirmed layers: `detectors/` for format detection, `processors/` for tokenizer selection, `services/source_parsing/` for orchestration, `containers/` for DI. `SourceDocumentParser.__init__` only takes `tokenizer_strategy` — needs two new optional params. `FormatDetectionError` and `ParserNotFoundError` already exist in `exceptions.py`. |
| Agent 3: Similar Features | `references/explorer-prompts.md` Agent 3 prompt | `FroalaFormatDetector.matches()` uses `any(marker in self._content for marker in _FROALA_MARKERS)` — identical pattern to use. `test_format_detector_strategy.py` and `test_froala_format_detector.py` show plain `pytest` style without fixtures for detector tests. Existing `test_source_document_parser.py` uses `Mock(spec=TokenizerStrategy)` pattern. |

---

## Approach Selected

**Selected:** Approach 1 — SeaFormatDetector + FormatParserResolver

**Rationale:** Each class has one responsibility (SRP). `SeaFormatDetector` mirrors `FroalaFormatDetector` exactly. `FormatParserResolver` is a pure dict mapping — independently testable. `SourceDocumentParser` change is minimal: one `_resolve_parser_name()` helper. Adding a third format later requires zero changes to `SourceDocumentParser` (OCP). The other two approaches violated SRP or created cross-layer dependencies.

**Alternatives rejected:**
- Approach 2 (inline in `SourceDocumentParser`) — violates SRP and DIP
- Approach 3 (`FormatDetectorStrategy.resolve_parser_name()`) — violates SRP and creates `detectors/` → `processors/` downward coupling

---

## Tasks Created

| # | Title | Files Created | Files Modified |
|---|-------|--------------|---------------|
| 1 | Add SEA_HTML to DocumentFormat enum | — | `src/data_migrator/schemas/models/fingerprint.py` |
| 2 | Implement SeaFormatDetector | `src/data_migrator/detectors/sea/__init__.py`, `src/data_migrator/detectors/sea/sea_format_detector.py`, `tests/unit/detectors/sea/__init__.py`, `tests/unit/detectors/sea/test_sea_format_detector.py` | — |
| 3 | Register SeaFormatDetector in FormatDetectorStrategy.create_default() | — | `src/data_migrator/detectors/format_detector_strategy.py`, `tests/unit/detectors/test_format_detector_strategy.py` |
| 4 | Implement FormatParserResolver | `src/data_migrator/processors/format_parser_resolver.py`, `tests/unit/processors/test_format_parser_resolver.py` | — |
| 5 | Wire auto-detection into SourceDocumentParser | `tests/unit/services/source_parsing/test_source_document_parser_auto.py` | `src/data_migrator/services/source_parsing/source_document_parser.py` |
| 6 | Wire FormatParserResolver into DefaultContainer | — | `src/data_migrator/containers/base.py` |

**Total:** 6 tasks, 6 files to create, 5 files to modify

---

## Test Scaffold Quality Check

Each task (all 6 are non-CLI tasks) has a test scaffold with one `def test_...` stub per test case:

| Task | Test Cases | Stubs Written | One-per-case? |
|------|-----------|--------------|--------------|
| Task 1 | 3 ✅ | 3 stubs | YES |
| Task 2 | 7 (6✅ + 1❌) | 7 stubs | YES |
| Task 3 | 3 ✅ | 3 stubs | YES |
| Task 4 | 3✅ + 1❌ | 4 stubs | YES |
| Task 5 | 3✅ + 1❌ | 4 stubs | YES |
| Task 6 | 3 ✅ | 3 stubs | YES |

All stubs include concrete arrange/act/assert skeletons with real fixture variables. No task uses the CLI regression exception. All tasks end with `> Follow /test-driven-development skill for test writing and red-green-clean cycle.`
