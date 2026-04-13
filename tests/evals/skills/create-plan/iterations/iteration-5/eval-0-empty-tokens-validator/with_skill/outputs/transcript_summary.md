# Transcript Summary: create-plan eval-0-empty-tokens-validator

## Phases Ran

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Parse & Setup | Complete | Slug: `validate-empty-tokens-before-processing`. Plan file already existed → created v2 variant: `2026-03-27-validate-empty-tokens-before-processing-v2.md` |
| Phase 2: Exploration | Complete | 1 explorer agent dispatched (Simple scope) |
| Phase 3: Design & Decisions | Complete | 3 approaches evaluated; clear winner selected without user questions |
| Phase 4: Write Plan | Complete | Plan written to `docs/plans/` |
| Phase 5: Summary & Handoff | Complete | No implementation performed |

---

## Explorer Agents Dispatched

**Count:** 1 (Simple scope — single base class, localized change)

**Agent 1: Utilities & Existing Implementations**

Findings:
- `EXISTING_IMPLEMENTATIONS`: No prior empty-tokens validator exists
- `REUSABLE_UTILITIES`:
  - `src/data_migrator/exceptions.py:DataMigratorError` — base exception class for new `EmptyTokensError`
  - `src/data_migrator/processors/tokenizers/base_parser.py:BaseTokenizerParser._log_metrics` — already computes `sum(len(line.tokens) for line in lines.values())`, same pattern the guard reuses
  - `src/data_migrator/services/text_processing/validators.py:TokenTypeValidator.validate_include_types` — canonical structlog-then-raise validation pattern
- `RELEVANT_MODELS`: `src/data_migrator/schemas/models/document.py` — `SourceLine.tokens`, `SourceDocument`
- `PATTERNS_FOUND`: (1) structlog error call → raise domain exception; (2) private `_validate_*()` methods on service/parser classes

Key files read during exploration:
- `src/data_migrator/processors/tokenizers/base_parser.py`
- `src/data_migrator/processors/tokenizers/token_pipeline.py`
- `src/data_migrator/processors/tokenizers/froala/froala_parser.py`
- `src/data_migrator/processors/tokenizers/sea/sea_parser.py`
- `src/data_migrator/schemas/models/document.py`
- `src/data_migrator/exceptions.py`
- `tests/unit/processors/tokenizers/test_base_parser.py`
- `src/data_migrator/services/document_migration_service.py`

---

## Approach Selected

**Selected:** Approach 1 — Guard in `BaseTokenizerParser.parse()`

**Rationale:** Lowest risk, minimal diff, single responsibility. Follows the Template Method pattern already in use. All parsers covered uniformly through the base class. Reuses the same token-count comprehension already present in `_log_metrics()`.

**Rejected alternatives:**
- Approach 2 (guard in `SourceDocumentParser.parse_content()`) — misses direct parser usage paths
- Approach 3 (Pydantic `field_validator` on `SourceDocument`) — violates SRP, high false-positive risk on valid empty docs in test fixtures

---

## Tasks Created

| # | Title | Files Modified | Files Created | Has Scaffold |
|---|-------|---------------|---------------|-------------|
| 1 | Add EmptyTokensError to exceptions.py | `src/data_migrator/exceptions.py` | `tests/unit/test_exceptions.py` | Yes — 3 stubs, 1 per test case |
| 2 | Add `_validate_tokens_not_empty()` guard to BaseTokenizerParser | `src/data_migrator/processors/tokenizers/base_parser.py`, `tests/unit/processors/tokenizers/test_base_parser.py` | — | Yes — 3 stubs, 1 per test case |
| 3 | Update FroalaParser edge-case tests | `tests/unit/processors/tokenizers/froala/test_froala_parser.py` | — | Yes — 2 stubs, 1 per test case |

**Total:** 3 tasks | 4 files to modify | 1 file to create

---

## Test Scaffold Quality Check

Each task (Tasks 1–3) includes a test scaffold with:
- `# Setup:` comment stating fixture/container requirements (all: "no fixture needed")
- One `def test_...` stub per `✅`/`❌` bullet point (not just the first)
- Concrete arrange/act/assert skeleton in each stub
- All stubs use real type names and concrete input values (not vague descriptions)

No CLI regression tasks were present, so no `# CLI regression — see Verification section` comments were needed.
