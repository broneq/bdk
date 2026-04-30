# Transcript Summary: Empty Tokens Validator Plan

## Task
Create an implementation plan for a validator that checks if the parsed tokens list is empty before processing starts and raises a descriptive exception.

## Exploration Steps

1. **Listed source files** under `src/data_migrator/processors/` and `src/data_migrator/services/` to map the codebase structure.
2. **Read `TokenizerInterface` (base.py)** — defines the `parse()` abstract method returning `SourceDocument`.
3. **Read `TokenizerStrategy`** — the registry/factory that returns a parser instance by name.
4. **Read `FroalaParser.parse()`** — HTML → `SourceDocument` via BeautifulSoup + extractors; empty content returns `lines={}` silently.
5. **Read `SeaContractsParser.parse()`** — same pattern for SEA format.
6. **Read `SourceDocumentParser`** — the service-layer facade: `parse_content()` calls `tokenizer_strategy.get_parser()` then `parser.parse()`. All external callers go through this layer.
7. **Read `MigrateDocumentUseCase.execute()`** — calls `source_document_parser.parse_content()`, then passes result straight to `migration_service.transform()`. No empty-check exists here.
8. **Read `DocumentMigrationService.transform()`** — iterates `normalized_document.lines`; zero lines = zero iterations = silent no-op.
9. **Read `exceptions.py`** — existing exception hierarchy; `DataMigratorError` is base.
10. **Read existing tests** for `SourceDocumentParser` — confirmed patterns: `Mock(spec=TokenizerStrategy)` + `mock_parser.parse.return_value`.
11. **Searched for existing empty-token guards** — none found.

## Key Decisions

- **Placement: `SourceDocumentParser.parse_content()`** (service layer), not inside individual parsers. This applies the check uniformly to all current and future parsers without duplication.
- **New exception: `EmptyTokensError(DataMigratorError)`** — follows existing convention; descriptive class name; message includes parser name and line count.
- **Check logic:** `sum(len(line.tokens) for line in document.lines.values()) == 0` — catches both zero-lines and lines-with-empty-tokens cases.
- **Existing test impact:** `test_parse_empty_file` currently expects a `SourceDocument` with zero lines returned — this test will need updating since the validator will now raise instead.

## Output

- Plan file: `docs/plans/2026-03-24-empty-tokens-validator.md`
- Changes: 2 files (`exceptions.py`, `source_document_parser.py`) + 1 new test file
