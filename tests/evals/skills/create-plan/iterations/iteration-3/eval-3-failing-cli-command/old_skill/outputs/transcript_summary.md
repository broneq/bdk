# Transcript Summary: create-plan for addition_position_preserved fix

## Task
Create an implementation plan to fix the failing CLI command:
```
uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
```
The error was described as occurring in `addition_position_preserved` axiom during `--verify`.

## Root Cause Discovered

The error message in the task description was misleading. The actual failure is:
```
error  xml_template_not_found  path=.../tests/fixtures/nype46/template.xml
Error: XML template not found: .../tests/fixtures/nype46/template.xml
```

The `addition_position_preserved` axiom is never reached — the CLI fails earlier when `MigrateDocumentUseCase._verify_if_requested()` tries to load the V2 XML template. The path stored in `var/template_diffs/nype46.json` points to a directory that no longer exists (`tests/fixtures/nype46/`) because fixtures were reorganized to `tests/fixtures/orv1/nype46/`.

Three template diffs are affected:
- `var/template_diffs/nype46.json` — absolute path to `tests/fixtures/nype46/template.xml` (missing)
- `var/template_diffs/nype81.json` — absolute path to `tests/fixtures/nype81/template.xml` (missing)
- `var/template_diffs/gencon1994-lo.json` — absolute path to `tests/fixtures/gencon1994-lo/template.xml` (missing)

## Key Files Analyzed

- `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/src/data_migrator/use_cases/migrate_document.py` — `_verify_if_requested` reads `v2_xml_path` from stored metadata
- `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/src/data_migrator/use_cases/import_template.py` — stores `str(v2_xml_path)` at import time (absolute path)
- `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/src/data_migrator/defaults/paths.py` — `get_project_root()` and `get_fixtures_path()` utilities
- `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/src/data_migrator/schemas/models/import_result.py` — `TemplateMetadata` with `v2_xml_path: str`
- `/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/var/template_diffs/nype46.json` — contains stale absolute path

## Exploration Scope

**Complexity assessed: MEDIUM** (cross-file, involves repository layer, use case, and data fix)

Launched 2 exploration agents (utilities + architecture). Key findings:
- `defaults/paths.py` is the right place for path utility functions
- `ImportTemplateUseCase` stores `str(v2_xml_path)` which captures absolute paths
- The fix requires both a code change (store relative paths) and a data fix (re-import templates)

## Design Decisions

**3 approaches explored:**
1. **Store Relative Paths + Runtime Resolution** (selected) — add `to_relative_path()` and `resolve_stored_path()` helpers in `defaults/paths.py`, use them at import and resolve time
2. **Pure Data Fix** (rejected) — run `prepare-default-data --overwrite`; doesn't fix root cause
3. **Fallback to DEFAULT_TEMPLATES config** (rejected) — couples use case to defaults module, doesn't handle custom templates

## Plan Written

**File:** `docs/plans/2026-03-24-fix-addition-position-preserved-axiom.md`

**5 tasks:**
1. Add `resolve_stored_path` + `to_relative_path` to `src/data_migrator/defaults/paths.py`
2. Modify `ImportTemplateUseCase` to store relative paths
3. Use `resolve_stored_path` in `MigrateDocumentUseCase._verify_if_requested`
4. Re-import affected templates via `prepare-default-data --overwrite`
5. Write integration test for end-to-end verify flow

**5 files to modify:** `defaults/paths.py`, `use_cases/import_template.py`, `use_cases/migrate_document.py`, plus 3 stale JSON files (regenerated)
**3 files to create:** `tests/unit/defaults/test_paths.py`, `tests/unit/use_cases/test_migrate_document_use_case_verify.py`, `tests/integration/test_migrate_document_verify.py`, `tests/integration/test_import_template_stores_relative_path.py`
