# Plan: In-Memory Caching for Repository Layer

**Date:** 2026-03-24
**Branch:** (new feature branch)
**Goal:** Add per-key in-memory caching to `TemplateDiffsFileRepository` and `TemplateRulesFileRepository` so that repeated `load()` calls for the same template name skip disk I/O. Cache must be invalidated on `save()` and `delete()`.

---

## 1. Background

The repository layer currently performs a full disk read on every `load()` call. During migration of a document, the same template's position index and rules can be loaded multiple times (e.g., once during verification, again during transformation). The decompression step (`PositionIndexCompressor.decompress`) on top of the JSON parse makes each load non-trivial.

`FingerprintFileRepository` already uses a single-entry `_cache: FingerprintIndex | None` pattern (lines 26–37 of `fingerprints/file_repository.py`). We extend this idea to a per-template dict cache inside `BaseJsonFileRepository` so all concrete repositories inherit it.

---

## 2. Design Decisions

### 2.1 Where to put the cache

**Option A – in `BaseJsonFileRepository`** (chosen)

`BaseJsonFileRepository` is the shared base for `TemplateDiffsFileRepository` and `TemplateRulesFileRepository`. Adding a typed cache there means both repositories get caching with zero duplication. The fingerprint repository does not extend this base, so it remains unaffected.

**Option B – in each concrete repository**

Leads to code duplication. Rejected.

**Option C – a separate `CachingRepositoryDecorator`**

Adds indirection and complicates the class hierarchy for minimal gain at this codebase size. Rejected.

### 2.2 Cache key

`template_name` (string, already sanitized before use) is the natural key. The cache is a `dict[str, T]` instance variable on the repository.

### 2.3 Thread safety

`BaseJsonFileRepository` is currently not thread-safe; `DefaultContainer` uses an `RLock` at the container level, which prevents concurrent access to the same repository instance from different use cases. No additional locking is needed inside the repository unless the requirement changes. This will be documented with a comment.

### 2.4 Cache invalidation

- `save()` → after writing to disk successfully, update the cache with the freshly deserialized value returned by `load()` (or store the `TemplateDiffsStorage` / `RulesConfig` before returning). This avoids a second disk read immediately after save.
- `delete()` → remove the key from the cache dict.
- Cache is never invalidated on `exists()` or `list_templates()` (read-only operations).

### 2.5 Generic type

`BaseJsonFileRepository[T]` already uses a TypeVar `T`. The cache dict will be `dict[str, T]`.

---

## 3. Files to Change

| File | Change |
|------|--------|
| `src/data_migrator/repositories/base_json_repository.py` | Add `_cache: dict[str, T]` to `__init__`, add `_invalidate_cache_entry(key)` and `_update_cache(key, value)` protected helpers, add `_get_cached(key)` helper. |
| `src/data_migrator/repositories/template_diffs/file_repository.py` | Call `_get_cached` at top of `load()`, call `_update_cache` after successful load; call `_update_cache` after successful `save()`; call `_invalidate_cache_entry` in `delete()` (via overriding or calling super). |
| `src/data_migrator/repositories/template_rules/file_repository.py` | Same pattern as above for `RulesConfig`. |
| `tests/unit/repositories/test_base_json_repository.py` | Add tests for cache hit, cache miss, invalidation. |
| `tests/unit/repositories/template_diffs/test_template_diffs_repository.py` | Add cache-behaviour tests. |
| `tests/unit/repositories/template_rules/test_template_rules_repository.py` | Add cache-behaviour tests. |

`FingerprintFileRepository` is **not** changed — it already has its own simpler cache and does not extend `BaseJsonFileRepository`.

---

## 4. Detailed Implementation Steps

### Step 1 – `BaseJsonFileRepository`: add cache infrastructure

```python
# base_json_repository.py (additions only)

def __init__(self, storage_path: Path) -> None:
    self._storage_path = storage_path
    self._storage_path.mkdir(parents=True, exist_ok=True, mode=0o755)
    self._cache: dict[str, T] = {}  # NOT thread-safe; container-level locking is sufficient

def _get_cached(self, key: str) -> T | None:
    return self._cache.get(key)

def _update_cache(self, key: str, value: T) -> None:
    self._cache[key] = value

def _invalidate_cache_entry(self, key: str) -> None:
    self._cache.pop(key, None)
```

Extend `delete()` to call `_invalidate_cache_entry` after successful unlink:

```python
def delete(self, template_name: str) -> bool:
    file_path = self._get_file_path(template_name)
    if file_path.exists():
        file_path.unlink()
        self._invalidate_cache_entry(template_name)
        self._log_deleted(template_name)
        return True
    return False
```

### Step 2 – `TemplateDiffsFileRepository.load()`: cache-first read

```python
@timed
def load(self, template_name: str) -> TemplateDiffsStorage:
    cached = self._get_cached(template_name)
    if cached is not None:
        return cached

    # ... existing disk-read logic ...

    result = self.compressor.decompress(compressed)
    self._update_cache(template_name, result)
    return result
```

### Step 3 – `TemplateDiffsFileRepository.save()`: populate cache after write

```python
def save(self, ...) -> Path:
    # ... existing write logic ...
    storage = self.compressor.compress(...)
    file_path.write_text(...)
    # Re-decompress to store the canonical in-memory value
    decompressed = self.compressor.decompress(storage)
    self._update_cache(template_name, decompressed)
    ...
    return file_path
```

> **Note:** The `save()` path already compresses → writes. To populate the cache without a second disk read, we decompress the `CompressedTemplateDiffsStorage` we just built. This is a CPU operation only (no I/O) and keeps the cache consistent.

### Step 4 – `TemplateRulesFileRepository.load()`: cache-first read

```python
@timed
def load(self, template_name: str) -> RulesConfig:
    cached = self._get_cached(template_name)
    if cached is not None:
        return cached

    # ... existing disk-read logic ...

    self._update_cache(template_name, rules)
    return rules
```

### Step 5 – `TemplateRulesFileRepository.save()`: populate cache after write

```python
def save(self, template_name: str, rules: RulesConfig) -> Path:
    # ... existing write logic ...
    self._update_cache(template_name, rules)
    return file_path
```

---

## 5. Tests to Add / Modify

### `test_base_json_repository.py` (new tests)

- `test_cache_starts_empty` – freshly created repo has no entries in `_cache`.
- `test_invalidate_cache_entry_removes_key` – after inserting a value, `_invalidate_cache_entry` removes it.
- `test_update_cache_stores_value` – `_update_cache` stores, `_get_cached` retrieves.
- `test_delete_invalidates_cache` – save then delete, verify `_cache` no longer has the key.

### `test_template_diffs_repository.py` (new tests)

- `test_load_caches_result` – after first load, `_cache` contains the entry.
- `test_second_load_skips_disk_read` – monkeypatch `Path.read_text` to raise after first call; second `load()` must succeed (from cache).
- `test_save_populates_cache` – after `save()`, `_cache[template_name]` is non-None.
- `test_save_overwrites_cache` – second `save()` with different data updates the cache.
- `test_delete_clears_cache` – save, load, delete; then `_cache` key is absent.

### `test_template_rules_repository.py` (new tests)

Same pattern as above, five analogous tests.

---

## 6. Edge Cases & Risks

| Risk | Mitigation |
|------|------------|
| Stale cache if file is modified externally | Out of scope: the app owns its storage directory and no external writer is expected. Document in code comments. |
| Large number of templates in memory | Each `TemplateDiffsStorage` can be 100 KB+. In typical usage <20 templates are active. Acceptable for now; can add LRU eviction later if needed. |
| `_cache` type annotation with `TypeVar` bound to base class | Use `dict[str, Any]` internally in the base, let subclasses narrow via their concrete return types. Alternatively, keep `dict[str, T]` and accept that mypy may need `cast`. |
| Cache populated with stale data after failed write | We only call `_update_cache` inside the `try` block **after** the write succeeds. On exception, cache is unchanged. |

---

## 7. Out of Scope

- LRU / TTL eviction (not needed given current usage patterns).
- Thread-safe locking inside the repository (handled at container level).
- Caching `list_templates()` or `exists()` results.
- Caching in `FingerprintFileRepository` (already has its own cache).

---

## 8. Acceptance Criteria

1. All existing repository tests continue to pass unchanged.
2. New cache tests cover: hit, miss, invalidation on delete, update on save.
3. `ruff check` and `mypy` pass with no new errors.
4. Cyclomatic complexity of modified methods remains B-grade (≤ 10).
