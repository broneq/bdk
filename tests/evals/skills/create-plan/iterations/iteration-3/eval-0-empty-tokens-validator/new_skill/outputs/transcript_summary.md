# Transcript Summary: create-plan — validate-empty-tokens

## Task
Create an implementation plan for: "Add a validator that checks if parsed tokens list is empty before processing starts and raises a descriptive exception."

## Phases Executed

### Phase 1: Parse & Setup
- Slug: `validate-empty-tokens`
- Plan file: `docs/plans/2026-03-24-validate-empty-tokens.md`
- Checked for existing plans — found related plans (`2026-03-24-empty-tokens-validator.md` and `2026-03-24-validate-empty-tokens-before-processing.md`) but the exact slug was new
- No design docs found in `docs/designs/`

### Phase 2: Exploration
- Dispatched 2 exploration passes using Serena tools
- **Existing exceptions found:** `DataMigratorError` (base), `ParserNotFoundError` — `EmptyTokensError` does NOT yet exist
- **Target class:** `SourceDocumentParser.parse_content()` — currently returns `parser.parse()` directly, no validation on result
- **Test impact:** `TestSourceDocumentParserIntegration::test_parse_empty_file` currently asserts `len(result.lines) == 0` — will break after the guard is added; identified as requiring update
- **Patterns found:** Private static validators on processing classes (`_validate_newline_placement` in `TokenExtractor`), structlog-before-raise pattern
- **Existing `mock_parser` fixture** returns a non-empty document — remains valid after change

### Phase 3: Design & Decisions
Three approaches evaluated:
1. **Static `_validate_non_empty` method on `SourceDocumentParser`** — SELECTED (LOW complexity, follows codebase patterns, zero new files, single guard point)
2. **Separate `ParsedDocumentValidator` class** — rejected (YAGNI violation; over-engineering for a 3-line check)
3. **Validation inside each individual parser** — rejected (DRY violation; wrong architectural layer)

Path was clear — proceeded without asking user questions.

### Phase 4: Write Plan
Plan written with 3 TDD tasks:
- **Task 1:** Add `EmptyTokensError` to `exceptions.py`
- **Task 2:** Add `_validate_non_empty` static method to `SourceDocumentParser` + call in `parse_content()` + update existing `test_parse_empty_file` test
- **Task 3:** Add focused message-content tests for the error output

## Key Findings
- `EmptyTokensError` does not exist yet in the codebase
- One existing test (`test_parse_empty_file`) requires update — it asserts empty lines count but will now expect `EmptyTokensError`
- `parse_file()` delegates to `parse_content()` automatically — no changes needed there
- The validation is a 3-line guard: count tokens across all lines, raise if zero

## Artifacts
- Plan file: `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/docs/plans/2026-03-24-validate-empty-tokens.md`
- Files to modify: 2 source files + 1 test file
- Files to create: 0
- Tasks: 3 implementation tasks (TDD cycles)
- Complexity: LOW
