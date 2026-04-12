# Plan: Fix addition_position_preserved Validation Failure (XML Template Not Found)

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Fix the `FileNotFoundError: XML template not found` failure that occurs when running `--verify` for nype46 (and similarly nype81, gencon1994-lo) by making `v2_xml_path` resolution robust to stale absolute paths.
**Architecture:** The `_verify_if_requested` method in `MigrateDocumentUseCase` resolves `v2_xml_path` from stored template metadata; when this stored absolute path is stale (pointing to a now-moved fixture), verification fails. The fix stores paths relative to project root and resolves them at runtime, then re-imports the affected templates. This prevents recurrence across machine migrations or fixture reorganizations.
**Complexity:** LOW

---

## Context

### What is Failing

Running:
```
uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
```

Fails with:
```
error    xml_template_not_found  path=/Users/.../tests/fixtures/nype46/template.xml
Error: XML template not found: .../tests/fixtures/nype46/template.xml
```

The log says `verification_started` but never reaches the `addition_position_preserved` axiom — the failure occurs earlier when `_verify_if_requested` tries to read the XML template from the path stored in `var/template_diffs/nype46.json`.

### Root Cause

When `data-migrator import-template` is run (or `prepare-default-data`), the `v2_xml_path` is stored as an absolute path in the template diff JSON:

```
var/template_diffs/nype46.json → metadata.v2_xml_path = "/Users/.../tests/fixtures/nype46/template.xml"
```

The fixture directory was reorganized: templates moved from `tests/fixtures/<name>/` to `tests/fixtures/orv1/<name>/`. The stored JSON was never re-imported. The actual file exists at `tests/fixtures/orv1/nype46/template.xml`.

Three template diffs contain stale absolute paths:
- `var/template_diffs/nype46.json` → `tests/fixtures/nype46/template.xml` (missing)
- `var/template_diffs/nype81.json` → `tests/fixtures/nype81/template.xml` (missing)
- `var/template_diffs/gencon1994-lo.json` → `tests/fixtures/gencon1994-lo/template.xml` (missing)

### Architecture Impact

The fix touches two layers:
1. **Repository layer** (`ImportTemplateUseCase` + `TemplateMetadata`): Store `v2_xml_path` as a path relative to project root (e.g., `tests/fixtures/orv1/nype46/template.xml`) so it survives machine migrations and directory reorganizations.
2. **Use case layer** (`MigrateDocumentUseCase._verify_if_requested`): Resolve the stored path relative to the project root.
3. **Data fix**: Re-import the three affected templates.

---

## Explored Approaches

### Approach 1: Store Relative Paths + Runtime Resolution (Selected)

**Description:** Modify `ImportTemplateUseCase.execute()` to store `v2_xml_path` relative to project root. Add a `PathResolver` utility that resolves stored relative (or old absolute) paths at runtime in `MigrateDocumentUseCase._verify_if_requested`. Re-import the three affected templates to fix the stale data.

**Design pattern:** Service Layer (path resolution as a small utility class)

**OO Principles:** SRP (path resolution isolated in `PathResolver`), DIP (use case depends on resolver abstraction)

**Pros:**
- Permanent fix: re-imported templates won't break on other machines or after directory moves
- Backward compatible: `PathResolver` gracefully falls back to treating path as absolute if relative fails
- Minimal blast radius: only `ImportTemplateUseCase` and `_verify_if_requested` change

**Cons:**
- Requires re-importing three templates (but this is a one-time data fix also achievable via `prepare-default-data --overwrite`)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/defaults/paths.py` — new `resolve_stored_path(path_str)` helper
- `src/data_migrator/use_cases/import_template.py` — store relative path
- `src/data_migrator/use_cases/migrate_document.py` — resolve path via helper
- `var/template_diffs/nype46.json`, `nype81.json`, `gencon1994-lo.json` — re-imported via `prepare-default-data --overwrite`

---

### Approach 2: Pure Data Fix (Not Selected)

**Description:** Simply run `uv run data-migrator prepare-default-data --overwrite` to re-import all templates, regenerating the JSON files with fresh absolute paths (which reflect the current machine's directory structure).

**Pros / Cons:** Immediate fix with zero code changes, but the absolute-path problem will recur whenever fixtures are reorganized or the project is run on a different machine.

**Why not selected:** Does not fix the root cause. Absolute paths are fragile across machines, environments, and directory reorganizations. The next fixture reorganization will cause the same breakage.

---

### Approach 3: Fallback to DEFAULT_TEMPLATES config (Not Selected)

**Description:** In `_verify_if_requested`, when the stored `v2_xml_path` is missing, look up the template name in `DEFAULT_TEMPLATES` config and compute the path from `get_fixtures_path()`.

**Pros / Cons:** No changes to storage format. But it only works for templates in `DEFAULT_TEMPLATES`, not custom templates.

**Why not selected:** Creates coupling between the use case and the `defaults` module. Custom templates would still break. Approach 1 is simpler and more general.

---

## Selected Approach: Store Relative Paths + Runtime Resolution

**Rationale:** Approach 1 addresses the root cause (absolute paths) while maintaining backward compatibility for any existing relative paths already stored correctly. The `PathResolver` utility is small, testable, and cleanly isolated. Combined with the data fix (re-import), this resolves both the immediate failure and prevents recurrence.

---

## Implementation Tasks

### Task 1: Add `resolve_stored_path` to `defaults/paths.py`

**Files:**
- Modify: `src/data_migrator/defaults/paths.py`
- Test: `tests/unit/defaults/test_paths.py`

**Test cases:**
- ✅ Positive: given `resolve_stored_path("tests/fixtures/orv1/nype46/template.xml")` on a machine where the project root contains that relative path, returns `Path(<project_root>/tests/fixtures/orv1/nype46/template.xml)` and the path exists
- ✅ Positive: given `resolve_stored_path("/absolute/path/to/template.xml")` where the absolute path exists, returns `Path("/absolute/path/to/template.xml")`
- ✅ Positive: given `resolve_stored_path("/stale/absolute/path/template.xml")` where the absolute path does NOT exist but the basename `template.xml` is not used, returns the `Path` object (existence check is caller's responsibility)
- ✅ Positive: given `resolve_stored_path("tests/fixtures/orv1/nype46/template.xml")` where the relative path does NOT exist as absolute, returns `Path(<project_root>/tests/fixtures/orv1/nype46/template.xml)`

**Implementation:**

Add to `src/data_migrator/defaults/paths.py`:

```python
def resolve_stored_path(path_str: str) -> Path:
    """Resolve a stored path string to an absolute Path.

    If the stored path is relative (does not start with /), resolves it
    relative to the project root. If absolute, returns it as-is.
    This handles migration from absolute to relative path storage.
    """
    path = Path(path_str)
    if path.is_absolute():
        return path
    return get_project_root() / path
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Make `ImportTemplateUseCase` store relative paths

**Files:**
- Modify: `src/data_migrator/use_cases/import_template.py`
- Test: `tests/integration/test_import_template_stores_relative_path.py` (new)

**Test cases:**
- ✅ Positive: after calling `ImportTemplateUseCase.execute()` with `v2_xml_path=<project_root>/tests/fixtures/orv1/nype46/template.xml`, the saved metadata's `v2_xml_path` is `tests/fixtures/orv1/nype46/template.xml` (relative, no leading slash)
- ✅ Positive: after calling with a path that is NOT under the project root (e.g., `/tmp/custom/template.xml`), the stored value is the absolute path unchanged
- ✅ Positive: `TemplateMetadata.validate_path_safety` does not raise for relative paths without `..` components

**Implementation:**

In `ImportTemplateUseCase.execute()`, before building `TemplateMetadata` at line ~197, convert `v2_xml_path` and `file_path` to relative paths:

```python
from data_migrator.defaults.paths import get_project_root, to_relative_path

# In execute():
project_root = get_project_root()
relative_v2_xml_path = to_relative_path(v2_xml_path, project_root)
relative_file_path = to_relative_path(file_path, project_root)

metadata = TemplateMetadata(
    parser_name=parser_name,
    file_path=str(relative_file_path),
    v2_xml_path=str(relative_v2_xml_path),
    ...
)
```

Add `to_relative_path` to `src/data_migrator/defaults/paths.py`:

```python
def to_relative_path(path: Path, base: Path) -> Path:
    """Convert path to relative if it is under base, else return unchanged.

    Raises:
        None (never raises — falls back to absolute path)
    """
    try:
        return path.relative_to(base)
    except ValueError:
        return path
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Use `resolve_stored_path` in `_verify_if_requested`

**Files:**
- Modify: `src/data_migrator/use_cases/migrate_document.py`
- Test: `tests/unit/use_cases/test_migrate_document_use_case_verify.py` (new or extend existing)

**Test cases:**
- ✅ Positive: given `template_storage.metadata.v2_xml_path = "tests/fixtures/orv1/nype46/template.xml"` (relative), `_verify_if_requested` resolves it to `<project_root>/tests/fixtures/orv1/nype46/template.xml` and calls `verification_service.verify()`
- ✅ Positive: given `template_storage.metadata.v2_xml_path = "/absolute/valid/path.xml"` that exists, `_verify_if_requested` uses the absolute path without modification
- ❌ Negative: given `template_storage.metadata.v2_xml_path = "nonexistent/template.xml"` (relative, doesn't exist), `_verify_if_requested` raises `FileNotFoundError` with path containing the resolved absolute path

**Implementation:**

In `src/data_migrator/use_cases/migrate_document.py`, in `_verify_if_requested`:

```python
from data_migrator.defaults.paths import resolve_stored_path

# Replace:
xml_path = Path(template_storage.metadata.v2_xml_path)

# With:
xml_path = resolve_stored_path(template_storage.metadata.v2_xml_path)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 4: Re-import affected templates to fix stale data

**Files:**
- Data fix: `var/template_diffs/nype46.json`, `var/template_diffs/nype81.json`, `var/template_diffs/gencon1994-lo.json`

**Test cases:**
- ✅ Regression: after running the CLI command, it exits 0 with no validation errors (see Regression section)
- ✅ Positive: after re-import, `var/template_diffs/nype46.json` metadata `v2_xml_path` is `tests/fixtures/orv1/nype46/template.xml` (relative path, no leading slash)

**Implementation:**

Run the CLI command to re-import all default templates (overwrites stale JSON files):

```bash
uv run data-migrator prepare-default-data --overwrite
```

This triggers `PrepareDefaultDataUseCase`, which calls `ImportTemplateUseCase.execute()` for each template in `DEFAULT_TEMPLATES`. After Task 2 is complete, the stored paths will be relative.

Verify the fix:
```bash
python3 -c "import json; d=json.load(open('var/template_diffs/nype46.json')); print(d['metadata']['v2_xml_path'])"
# Expected: tests/fixtures/orv1/nype46/template.xml  (no leading slash)
```

> NOTE: Do NOT commit the modified `var/template_diffs/*.json` files — they are generated data and should be regenerated on each machine. Check `.gitignore` to verify.

---

### Task 5: Write integration test for end-to-end verify flow

**Files:**
- Test: `tests/integration/test_migrate_document_verify.py` (new)

**Test cases:**
- ✅ Positive: given a `MockContainer` with `TemplateDiffsStorage` containing relative `v2_xml_path = "tests/fixtures/orv1/nype46/template.xml"`, calling `use_case.execute(request_with_verify=True)` returns `MigrateDocumentResult` with `verification` set (not `None`)
- ✅ Positive: given a `MockContainer` with `TemplateDiffsStorage` containing `verify=False`, `use_case.execute()` returns `verification=None` (no file access)
- ❌ Negative: given relative `v2_xml_path = "nonexistent/template.xml"` that doesn't resolve to an existing file, `execute()` raises `FileNotFoundError` containing the resolved absolute path

**Implementation:**

Use `MockContainer` pattern from existing integration tests:

```python
from data_migrator.containers import MockContainer
from data_migrator.schemas.models.migration_request import MigrationRequest
from data_migrator.defaults.paths import get_fixtures_path

def test_verify_resolves_relative_v2_xml_path(mock_template_storage_with_relative_path):
    container = MockContainer()
    container.set_template_diffs_repository(mock_repo_returning(mock_template_storage_with_relative_path))
    use_case = container.get_migrate_document_use_case()
    request = MigrationRequest(
        template_name="nype46",
        file_content=...,
        verify=True,
    )
    result = use_case.execute(request)
    assert result.verification is not None
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/defaults/paths.py:get_project_root` — project root detection via `pyproject.toml` traversal
- `src/data_migrator/defaults/paths.py:get_fixtures_path` — returns `<project_root>/tests/fixtures`
- `src/data_migrator/containers/base.py:MockContainer` — DI container for tests

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/import_result.py` — `TemplateMetadata` with `v2_xml_path: str`
- `src/data_migrator/schemas/models/template_storage.py` — `TemplateDiffsStorage` loaded at migrate time

**Patterns to follow:**
- Path resolution utilities follow the `get_project_root()` pattern in `defaults/paths.py` (simple functions, no class needed)
- Integration tests use `MockContainer.set_*()` setters for dependency injection

**Test helpers to use:**
- `tests/helpers/assertions.py` — existing assertion helpers
- `tests/helpers/factories.py` — existing factory functions

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/defaults/test_paths.py tests/unit/use_cases/test_migrate_document_use_case_verify.py tests/integration/test_migrate_document_verify.py tests/integration/test_import_template_stores_relative_path.py -v --cov=src/data_migrator/defaults --cov=src/data_migrator/use_cases
Coverage targets:
  - Critical paths: >90%
  - Business logic: >85%
```

### Code Quality

Delegate to `static-analyse` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Regression

```
Run: uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
Expected: exits 0 with no validation errors (no xml_template_not_found error)
```

### Edge Cases to Test

- Stored path is already relative and correct (no double-resolution)
- Stored path is absolute and valid (no breakage for recently imported templates like nype93, nype2015)
- Path contains non-ASCII characters in project root (handled by `pathlib`)
- Template `v2_xml_path` points to a file outside the project root (custom template — stored as absolute)

---

## Success Criteria

**Must have:**
- `uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify` exits 0
- All three affected templates (nype46, nype81, gencon1994-lo) work with `--verify`
- New templates imported after this fix store relative paths in JSON metadata
- All existing tests pass (no regressions for nype93, nype2015, gencon1994 etc.)
- `resolve_stored_path` handles both relative and absolute inputs correctly

**Nice to have:**
- Verify that `gencon1994-lo.json` also has the stale path fixed (same pattern)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** N/A

**Memories Referenced:**
- N/A (this is a data/path issue, no architectural memories needed)

**Similar Implementations:**
- `src/data_migrator/defaults/paths.py:get_project_root` — serves as example for path utility functions
- `src/data_migrator/use_cases/import_template.py:_check_files_exist` — example of path existence checking pattern
