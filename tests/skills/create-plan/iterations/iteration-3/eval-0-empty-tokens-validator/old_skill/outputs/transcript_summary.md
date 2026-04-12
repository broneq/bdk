# Transcript Summary: create-plan for Empty Tokens Validator

## Task
Add a validator that checks if parsed tokens list is empty before processing starts and raises a descriptive exception.

## Phase 1: Parse & Setup
- Input validated as specific and actionable (>10 words, concrete requirement)
- Slug: `validate-empty-tokens-before-processing`
- Plan path: `docs/plans/2026-03-24-validate-empty-tokens-before-processing.md`
- Existing plan found at path (overwritten for fresh generation)
- No related design docs found in `docs/designs/`

## Phase 2: Exploration (2 agents — Medium scope)

### Key findings:
- **Entry point:** `SourceDocumentParser.parse_content()` at `src/data_migrator/services/source_parsing/source_document_parser.py` — called by `MigrateDocumentUseCase.execute()` and feeds into `DocumentMigrationService.transform()`
- **Both parsers:** `FroalaParser` and `SeaContractsParser` implement `TokenizerInterface.parse()` → returns `SourceDocument(lines: dict[int, SourceLine])`
- **Gap found:** Empty HTML input returns `lines={}` silently; `DocumentMigrationService.transform()` processes it without error, producing zero migration entries
- **Validator pattern:** `TokenTypeValidator` at `src/data_migrator/services/text_processing/validators.py` — stateless class, `@staticmethod validate()`, structlog error before raise
- **Exception hierarchy:** All custom exceptions inherit from `DataMigratorError` in `src/data_migrator/exceptions.py`; no existing empty-document exception
- **Test patterns:** `Mock(spec=TokenizerStrategy)` fixtures, `pytest.raises(ExcType, match="...")`, existing tests in `tests/unit/services/source_parsing/test_source_document_parser.py`
- **Existing test to update:** `test_parse_empty_file` asserts `len(result.lines) == 0` — must change to expect `EmptySourceDocumentError`

## Phase 3: Design Decisions

Three approaches analyzed:

| Approach | Pattern | Complexity | Risk | Decision |
|----------|---------|-----------|------|----------|
| A: Dedicated SourceDocumentValidator class | SRP validator (follows TokenTypeValidator) | LOW | LOW | **SELECTED** |
| B: Private static method on SourceDocumentParser | Inline guard | LOW | LOW | Rejected (SRP violation) |
| C: Check in each parser's parse() | Parser-level guard | LOW | MEDIUM | Rejected (DRY + layer violation) |

**Selected: Approach A** — dedicated `SourceDocumentValidator` class following `TokenTypeValidator` pattern. Single validation point, independently testable, extensible, proper SRP.

No user questions needed — clear path forward.

## Phase 4: Plan Written

4 tasks, 2 files to modify, 2 files to create:

### Tasks:
1. **Add `EmptySourceDocumentError`** to `src/data_migrator/exceptions.py`
2. **Create `SourceDocumentValidator`** at `src/data_migrator/services/source_parsing/source_document_validator.py`
3. **Wire validator** into `SourceDocumentParser.parse_content()`
4. **Update existing test** `test_parse_empty_file` to expect `EmptySourceDocumentError`

### Complete code provided for all tasks including:
- Full `EmptySourceDocumentError` class definition
- Full `SourceDocumentValidator` class with structlog error before raise
- Updated `source_document_parser.py` content
- All test cases with concrete inputs and expected outputs

## Output Files
- Plan: `docs/plans/2026-03-24-validate-empty-tokens-before-processing.md`
- Copied to: `/tmp/claude/create-plan-workspace/iteration-2/eval-0-empty-tokens-validator/new_skill/outputs/plan.md`
