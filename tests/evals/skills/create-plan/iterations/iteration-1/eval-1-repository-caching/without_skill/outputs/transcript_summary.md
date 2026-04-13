# Transcript Summary: Repository In-Memory Caching Plan

## Task
Create an implementation plan for adding in-memory caching to the repository layer so that repeated reads of the same file skip disk I/O, with cache invalidation on write.

## Exploration Steps

1. **Discovered the repository structure**: Three concrete file repositories exist — `TemplateDiffsFileRepository`, `TemplateRulesFileRepository`, and `FingerprintFileRepository`. The first two extend the shared `BaseJsonFileRepository[T]` generic base class; `FingerprintFileRepository` does not.

2. **Found an existing caching precedent**: `FingerprintFileRepository` already implements a simple single-entry cache (`_cache: FingerprintIndex | None`) with read-through on `load_index()` and write-through on `save_index()`. This confirms the pattern is already accepted in the codebase.

3. **Analysed `BaseJsonFileRepository`**: It provides `__init__`, `_get_file_path`, `exists`, `delete`, and `list_templates`. The `delete` method unlinks the file but does not yet touch any cache. This is the ideal place to add cache infrastructure shared by both concrete repos.

4. **Reviewed test coverage**: Existing tests exercise save/load/delete/exists/list_templates round-trips but do not test any caching behaviour. The test factories and fixtures are straightforward; adding cache tests alongside them will be easy.

5. **Checked `DefaultContainer`**: Thread-safe lazy init via `RLock` at container level means each repository instance is accessed from one logical thread at a time — no additional lock needed inside the repository.

## Key Design Decisions

- **Add cache to `BaseJsonFileRepository`** (not to each concrete class): eliminates duplication.
- **Cache key = `template_name`** (string): same key already used for file lookup.
- **Cache populated in `load()` and `save()`**: after `save()` we decompress the compressed object we just built (CPU only, no extra I/O) to populate the cache; after `load()` we cache the returned object.
- **Cache invalidated in `delete()`**: key removed from dict inside the base-class `delete()` method.
- **No thread-safe locking inside repository**: documented decision, relies on container-level `RLock`.
- **`FingerprintFileRepository` unchanged**: already has its own cache, not part of the base hierarchy.

## Files to Modify
- `src/data_migrator/repositories/base_json_repository.py`
- `src/data_migrator/repositories/template_diffs/file_repository.py`
- `src/data_migrator/repositories/template_rules/file_repository.py`
- `tests/unit/repositories/test_base_json_repository.py`
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`
- `tests/unit/repositories/template_rules/test_template_rules_repository.py`

## Output
Plan written to: `docs/plans/2026-03-24-repository-in-memory-caching.md`
