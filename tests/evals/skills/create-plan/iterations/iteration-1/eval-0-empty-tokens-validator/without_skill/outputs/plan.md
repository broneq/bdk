# Empty Tokens Validator

**Date:** 2026-03-24
**Branch:** `poc/sea-contracts-parser`
**Complexity:** SMALL
**Pattern:** Guard clause in `SourceDocumentParser.parse_content()` + new exception

---

## Context

When an HTML document is parsed by `FroalaParser` or `SeaContractsParser`, the result is a `SourceDocument` with a `lines` dict. Each `SourceLine` carries a `tokens` list. If the parser receives malformed, empty, or structurally unrecognisable HTML content, it can silently return a `SourceDocument` with zero lines — and therefore zero tokens across all lines.

Downstream, `DocumentMigrationService.transform()` iterates over `normalized_document.lines` and never warns the caller that nothing was parsed. The migration completes "successfully" with zero entries, which is a silent data-loss failure.

**Goal:** Raise a descriptive, typed exception at the earliest possible point — immediately after `parser.parse()` returns — so callers receive actionable feedback instead of a silent no-op.

---

## Design Decision: Where to add the check

### Option A – Inside each parser (`FroalaParser.parse()`, `SeaContractsParser.parse()`)
- Pro: self-contained per parser
- Con: duplicated logic, each future parser must remember to add it
- Con: breaks SRP — parsing and validation mixed

### Option B – In `SourceDocumentParser.parse_content()` (chosen)
- Single place, applies to **all** registered parsers uniformly
- `parse_content()` is the service-layer facade that all callers go through
- `parse_file()` already delegates to `parse_content()`, so coverage is automatic
- Consistent with project pattern: validation lives in the service layer, not deep in processors

---

## New Exception

Add `EmptyTokensError` to `src/data_migrator/exceptions.py`:

```python
class EmptyTokensError(DataMigratorError):
    """Raised when a parsed document contains no tokens across all lines.

    Indicates the input content was empty, malformed, or produced no
    extractable structure from the tokenizer.
    """
    pass
```

Inherits from `DataMigratorError` — consistent with all other domain exceptions.

---

## Changes

### 1. `src/data_migrator/exceptions.py`

Insert `EmptyTokensError` after `ParserNotFoundError` (line 11):

```python
class EmptyTokensError(DataMigratorError):
    """Raised when a parsed document contains no tokens across all lines.

    Indicates the input content was empty, malformed, or produced no
    extractable structure from the tokenizer.
    """
    pass
```

### 2. `src/data_migrator/services/source_parsing/source_document_parser.py`

Add import and a validation call after `parser.parse()` in `parse_content()`:

```python
from data_migrator.exceptions import EmptyTokensError

# inside parse_content(), after parser.parse():
document = parser.parse(token_filter=token_filter)
_validate_tokens_not_empty(document, parser_name)
return document
```

Add static helper (keeps `parse_content` readable, pure function):

```python
@staticmethod
def _validate_tokens_not_empty(document: SourceDocument, parser_name: str) -> None:
    """Raise EmptyTokensError if document has no tokens in any line.

    Raises:
        EmptyTokensError: If all lines contain zero tokens
    """
    total_tokens = sum(len(line.tokens) for line in document.lines.values())
    if total_tokens == 0:
        logger.error(
            "empty_tokens_after_parsing",
            parser=parser_name,
            total_lines=len(document.lines),
        )
        raise EmptyTokensError(
            f"Parser '{parser_name}' produced a document with no tokens. "
            f"The input may be empty, malformed, or unrecognisable to this parser. "
            f"Lines found: {len(document.lines)}."
        )
```

**Note:** A document with lines but zero total tokens is also invalid (e.g., lines that contain only empty-string tokens after filtering). The check counts across all lines to cover both cases: zero lines and lines-with-no-tokens.

---

## File Diff Summary

| File | Change |
|------|--------|
| `src/data_migrator/exceptions.py` | Add `EmptyTokensError` class |
| `src/data_migrator/services/source_parsing/source_document_parser.py` | Import `EmptyTokensError`, call `_validate_tokens_not_empty`, add static method |

---

## Test Plan (TDD)

### New test file: `tests/unit/services/source_parsing/test_empty_tokens_validator.py`

#### Test cases

| Test | Input | Expected |
|------|-------|----------|
| `test_raises_when_zero_lines` | Parser returns `SourceDocument(lines={})` | `EmptyTokensError` raised with parser name in message |
| `test_raises_when_lines_have_no_tokens` | Parser returns document with 2 lines, each `tokens=[]` | `EmptyTokensError` raised |
| `test_passes_when_at_least_one_token` | Parser returns document with 1 line, 1 token | No exception, document returned |
| `test_exception_message_includes_parser_name` | Parser name `"froala"`, empty document | `"froala"` in exception message |
| `test_exception_message_includes_line_count` | 3 lines with no tokens | `"Lines found: 3"` in message |
| `test_parse_file_also_validates` | `parse_file()` wraps `parse_content()` → same validation | `EmptyTokensError` raised via file path |

All tests use `Mock` for `TokenizerStrategy` and `Mock.parse.return_value` — no real HTML needed.

### Existing test updates

- `tests/unit/services/source_parsing/test_source_document_parser.py`
  - `test_parse_empty_file`: currently asserts `len(result.lines) == 0` — this test will now need to assert `EmptyTokensError` is raised (the mock returns `lines={}`, which triggers the validator). **Update mock to return at least one token**, or adjust the test to expect `EmptyTokensError`.

---

## Acceptance Criteria

1. `EmptyTokensError` is a proper `DataMigratorError` subclass in `exceptions.py`
2. `parse_content()` raises `EmptyTokensError` when the parsed document has zero total tokens
3. `parse_file()` inherits the same behaviour (no changes needed — it delegates to `parse_content()`)
4. Exception message includes parser name and lines count
5. structlog logs `empty_tokens_after_parsing` at `error` level before raising
6. All new tests pass; no regressions in existing suite
7. mypy strict passes (no `Any`, all types annotated)
8. ruff check passes (no unused imports, style clean)

---

## Out of Scope

- Filtering by specific token types (e.g., only raise if no non-placeholder tokens) — YAGNI, simple total count is sufficient
- Validation inside individual parsers — handled at the service layer
- Warning (vs. error) mode — always raise; callers decide how to handle
