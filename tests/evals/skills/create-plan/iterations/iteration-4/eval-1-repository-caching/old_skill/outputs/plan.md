# Plan: Add In-Memory Caching to Repository Layer

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Add in-memory caching to `BaseJsonFileRepository` so repeated `load()` calls for the same template skip disk I/O, with cache invalidation on `save()` and `delete()`.
**Architecture:** Extend `BaseJsonFileRepository[T]` with a `dict[str, T]` cache field and two hook methods `_cache_load()` and `_invalidate_cache(template_name)`. Concrete subclasses call these hooks inside their `load()` and `save()`/`delete()` overrides. No changes to abstract interfaces or containers.
**Complexity:** LOW

---

## Context

The migrator reads JSON template files from disk on every `load()` call. During a `migrate` command that processes many documents against the same template, `TemplateDiffsFileRepository.load()` and `TemplateRulesFileRepository.load()` are called repeatedly for the same template name, resulting in redundant disk reads and JSON parsing.

`FingerprintFileRepository` already demonstrates the project's approved caching pattern: a `_cache` field on the instance, populated on first read and invalidated on write. However, because `FingerprintFileRepository` does not extend `BaseJsonFileRepository`, that pattern was implemented independently. This plan brings the same pattern to `BaseJsonFileRepository` so all multi-file template repositories benefit.

The caching is process-local and instance-scoped. Because `DefaultContainer` creates one repository instance per process (lazy, scope-cached), the cache lives for the lifetime of the process. There is no need for TTL or LRU eviction: the data set (template files) is small and changes only during `import-template` or `import-rules` commands, both of which call `save()` and therefore trigger cache invalidation.

---

## Explored Approaches

### Approach 1: Add caching to `BaseJsonFileRepository` (Selected)

**Description:** Add a `_cache: dict[str, T]` field to the generic base class. Expose two protected helpers: `_get_cached(template_name)` returning `T | None` and `_set_cached(template_name, value)`. Add `_evict_cached(template_name)` which concrete subclasses call from `save()` and `delete()`. The base `delete()` already exists, so it calls `_evict_cached()` directly — no change needed in subclasses for deletion.

**Pros:**
- Single implementation: both `TemplateDiffsFileRepository` and `TemplateRulesFileRepository` gain caching automatically once the base is updated
- Consistent with the FingerprintFileRepository pattern already in the codebase
- Zero changes to abstract interfaces or containers

**Cons:**
- Base class grows slightly in responsibility (but caching is a cross-cutting concern, not domain logic)
- Generic `T` means the cache stores whatever the subclass puts in — relies on subclasses calling the hooks correctly

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/repositories/base_json_repository.py`
- `src/data_migrator/repositories/template_diffs/file_repository.py`
- `src/data_migrator/repositories/template_rules/file_repository.py`
- `tests/unit/repositories/test_base_json_repository.py`
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`
- `tests/unit/repositories/template_rules/test_template_rules_repository.py`

---

### Approach 2: Caching Decorator / Wrapper (Not Selected)

**Description:** Create `CachedTemplateDiffsRepository` and `CachedTemplateRulesRepository` wrappers that implement the abstract interfaces and delegate to the file repositories, adding a `dict` cache between them. Wire the wrappers in `DefaultContainer`.

**Pros / Cons:** Follows Open/Closed Principle strictly — existing classes are untouched. But requires two new classes, doubles the interface footprint, and makes the container more complex. The DRY cost outweighs the OCP benefit here since the caching logic is identical across both repositories.

**Why not selected:** More boilerplate with no practical benefit. The Decorator pattern is appropriate when wrapping classes you cannot modify; here we own the base class.

---

### Approach 3: Cache per concrete subclass (Not Selected)

**Description:** Add `_cache: dict[str, TemplateDiffsStorage] | None` independently to each concrete repository class, mirroring exactly how `FingerprintFileRepository` works.

**Pros / Cons:** Minimal base class change. But duplicates the same `_cache` initialization, lookup, and invalidation logic in two places. Violates DRY with no offsetting benefit.

**Why not selected:** The base class approach achieves the same result without code duplication.

---

## Selected Approach: Add caching to `BaseJsonFileRepository`

**Rationale:** The base class already handles `delete()` (which must invalidate cache), directory creation, and path sanitization. Adding the cache dict and three small helpers fits naturally into that layer. It is the smallest change that delivers caching for all current and future `BaseJsonFileRepository` subclasses. The FingerprintFileRepository proves the pattern works; this plan standardizes it.

---

## Implementation Tasks

### Task 1: Add cache infrastructure to `BaseJsonFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/base_json_repository.py`
- Test: `tests/unit/repositories/test_base_json_repository.py`

**Test cases:**
- ✅ Positive: after `ConcreteRepository.save("tmpl", data)` then `_set_cached("tmpl", data)`, calling `_get_cached("tmpl")` returns `data`
- ✅ Positive: `_get_cached("unknown")` returns `None` when nothing is cached
- ✅ Positive: after `_set_cached("tmpl", data)` then `_evict_cached("tmpl")`, calling `_get_cached("tmpl")` returns `None`
- ✅ Positive: `_evict_cached("nonexistent")` does not raise — silent no-op
- ✅ Positive: `delete("tmpl")` (which internally calls `_evict_cached`) clears the cache entry after save + manual cache population

**Implementation:**

Add to `BaseJsonFileRepository.__init__`:
```python
self._cache: dict[str, T] = {}
```

Add three protected methods:
```python
def _get_cached(self, template_name: str) -> T | None:
    return self._cache.get(template_name)

def _set_cached(self, template_name: str, value: T) -> None:
    self._cache[template_name] = value

def _evict_cached(self, template_name: str) -> None:
    self._cache.pop(template_name, None)
```

Modify `delete()` to call `_evict_cached` before (or after) file removal:
```python
def delete(self, template_name: str) -> bool:
    file_path = self._get_file_path(template_name)
    if file_path.exists():
        file_path.unlink()
        self._evict_cached(template_name)
        self._log_deleted(template_name)
        return True
    return False
```

> Follow `/test-driven-development` skill for the red-green-clean cycle.

---

### Task 2: Add caching to `TemplateDiffsFileRepository.load()` and `save()`

**Files:**
- Modify: `src/data_migrator/repositories/template_diffs/file_repository.py`
- Test: `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`

**Test cases:**
- ✅ Positive: given a saved template `"nype2015"`, calling `load("nype2015")` twice returns equal objects and the second call does not read the file (verify by removing the file between calls — second call should still succeed because it hits cache)
- ✅ Positive: after `save("nype2015", index, metadata)` then `load("nype2015")`, the returned object equals the saved data (cache is populated by save, no disk read needed)
- ✅ Positive: after `save("nype2015", index_v1, metadata)` then `save("nype2015", index_v2, metadata)`, `load("nype2015")` returns `index_v2` (save invalidates stale cache, writes new data, populates fresh cache)
- ✅ Positive: after `save` then `delete("nype2015")`, calling `load("nype2015")` raises `TemplateDiffNotFoundError` (cache evicted on delete)

**Implementation:**

In `TemplateDiffsFileRepository.save()`, after writing JSON successfully, call:
```python
storage = self.compressor.compress(...)
# ... write to disk ...
self._set_cached(template_name, self.compressor.decompress(storage))
```

Wait — the `save()` already compresses and writes. We can store the `TemplateDiffsStorage` (decompressed form) in cache because `load()` returns `TemplateDiffsStorage`. So after the disk write succeeds:
```python
# After file_path.write_text(...)
decompressed = self.compressor.decompress(storage)
self._set_cached(template_name, decompressed)
return file_path
```

In `TemplateDiffsFileRepository.load()`, check cache first:
```python
@timed
def load(self, template_name: str) -> TemplateDiffsStorage:
    cached = self._get_cached(template_name)
    if cached is not None:
        return cached

    file_path = self._get_file_path(template_name)
    if not file_path.exists():
        raise TemplateDiffNotFoundError(f"No template found for '{template_name}'")

    try:
        data_dict = json.loads(file_path.read_text(encoding="utf-8"))
        compressed = CompressedTemplateDiffsStorage(**data_dict)
        result = self.compressor.decompress(compressed)
        self._set_cached(template_name, result)
        return result
    except OSError as e:
        ...
```

> Follow `/test-driven-development` skill for the red-green-clean cycle.

---

### Task 3: Add caching to `TemplateRulesFileRepository.load()` and `save()`

**Files:**
- Modify: `src/data_migrator/repositories/template_rules/file_repository.py`
- Test: `tests/unit/repositories/template_rules/test_template_rules_repository.py`

**Test cases:**
- ✅ Positive: given saved rules for `"nype2015"`, calling `load("nype2015")` twice returns equal `RulesConfig` and the second call does not read disk (remove file between calls — second call hits cache and succeeds)
- ✅ Positive: after `save("nype2015", rules_v1)` then `save("nype2015", rules_v2)`, `load("nype2015")` returns `rules_v2` (cache invalidated and repopulated by second save)
- ✅ Positive: after `save` then `delete("nype2015")`, `load("nype2015")` raises `TemplateRulesNotFoundError` (cache evicted on delete)

**Implementation:**

In `TemplateRulesFileRepository.save()`, after writing JSON:
```python
# After file_path.write_text(...)
self._set_cached(template_name, rules)
return file_path
```

In `TemplateRulesFileRepository.load()`, check cache first:
```python
@timed
def load(self, template_name: str) -> RulesConfig:
    cached = self._get_cached(template_name)
    if cached is not None:
        return cached

    file_path = self._get_file_path(template_name)
    if not file_path.exists():
        raise TemplateRulesNotFoundError(f"No rules found for '{template_name}'")

    try:
        data_dict = json.loads(file_path.read_text(encoding="utf-8"))
        rules = RulesConfig(**data_dict)
        self._set_cached(template_name, rules)
        logger.debug(
            "template_rules_loaded",
            template_name=template_name,
            rule_count=len(rules.rules),
            file_path=str(file_path),
        )
        return rules
    except OSError as e:
        ...
```

> Follow `/test-driven-development` skill for the red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` - existing caching pattern: `_cache` field, check-before-load, set-on-write

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/template_storage.py` - `TemplateDiffsStorage` (cached type for template diffs)
- `src/data_migrator/schemas/models/rules.py` - `RulesConfig` (cached type for template rules)

**Patterns to follow:**
- `FingerprintFileRepository._cache: FingerprintIndex | None` - assign `None` or value; check `is not None` before returning cached
- `BaseJsonFileRepository.delete()` - already the right hook point for cache eviction (base class owns file deletion)

**Test helpers to use:**
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py:create_test_position_index` - factory for `DocumentPositionIndex`
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py:create_test_metadata` - factory for `TemplateMetadata`
- `tests/unit/repositories/template_rules/test_template_rules_repository.py` fixture `sample_rules_config`

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/repositories/ -v --cov=src/data_migrator/repositories
Coverage targets:
  - Critical paths (cache hit, miss, invalidation): >90%
  - Business logic (load/save round-trips): >85%
```

### Code Quality

Delegate to `static-analyse` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Edge Cases to Test

- Cache miss: `_get_cached()` on a name that was never saved returns `None`
- Cache isolation: caching `"template_a"` does not affect `"template_b"`
- Eviction after delete: `delete()` removes from cache; subsequent `load()` raises `NotFoundError` (no file remains)
- Overwrite invalidation: two sequential `save()` calls with different data; `load()` returns second data
- Cache not populated on failed load: if `load()` raises `TemplateDiffLoadError` (corrupt JSON), cache must remain empty for that key

---

## Success Criteria

**Must have:**
- `BaseJsonFileRepository` has `_get_cached`, `_set_cached`, `_evict_cached` helpers
- `BaseJsonFileRepository.delete()` calls `_evict_cached` before returning
- `TemplateDiffsFileRepository.load()` returns cached value on second call without touching disk
- `TemplateDiffsFileRepository.save()` populates cache with the decompressed storage
- `TemplateRulesFileRepository.load()` returns cached value on second call without touching disk
- `TemplateRulesFileRepository.save()` populates cache with the rules object
- All tests pass
- Static analysis passes
- Coverage meets thresholds

**Nice to have:**
- Add `structlog` debug log line in `load()` when cache hit occurs (e.g., `logger.debug("template_cache_hit", template_name=template_name)`)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** N/A

**Memories Referenced:**
- `project_overview` - architecture layers, repository pattern
- `utility_classes` - FingerprintFileRepository as existing cache reference

**Similar Implementations:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` - serves as template for instance-level caching with invalidation on write
