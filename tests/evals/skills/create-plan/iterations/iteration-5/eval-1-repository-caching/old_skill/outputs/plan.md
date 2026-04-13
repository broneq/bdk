# Plan: Add In-Memory Caching to Repository Layer

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Cache deserialized models in `BaseJsonFileRepository` subclasses so repeated reads skip disk I/O, and invalidate the cache on write or delete.
**Architecture:** Cache helpers (`_cache_get`, `_cache_put`, `_cache_invalidate`) are added to `BaseJsonFileRepository[T]`, and each concrete repository calls them from its `load()`, `save()`, and `delete()` implementations. The fingerprint repository already follows this pattern with its `_cache` field; we normalise and extend it.
**Complexity:** LOW

---

## Context

The repository layer currently re-reads and re-deserializes JSON from disk on every `load()` call. During a single migration run the same template diffs and rules may be loaded multiple times (once to verify, once to transform), resulting in redundant disk I/O and decompression. Adding a simple per-instance `dict[str, T]` cache inside `BaseJsonFileRepository` eliminates this without any architectural change.

The `FingerprintFileRepository` already uses a `_cache: FingerprintIndex | None` field for its single-document pattern. This plan extends that principle to the multi-key repositories — `TemplateDiffsFileRepository` and `TemplateRulesFileRepository` — using `dict[str, T]` keyed by template name.

Cache invalidation is straightforward: `save()` stores the newly serialized value in the cache; `delete()` removes it. This ensures the in-memory state is always consistent with disk after a write operation.

---

## Explored Approaches

### Approach 1: Cache helpers in BaseJsonFileRepository (Selected)

**Description:** Add a `_cache: dict[str, T]` field and three protected helpers (`_cache_get`, `_cache_put`, `_cache_invalidate`) to `BaseJsonFileRepository[T]`. Concrete repositories call these helpers from their own `load()`, `save()`, and `delete()`. Follows the existing pattern in `FingerprintFileRepository`.

**Design pattern:** Template Method (base provides storage hooks; subclasses control domain logic)

**OO principles:** SRP — caching is encapsulated in the base; subclasses remain focused on (de)serialization. OCP — no changes to abstract interfaces. DIP — callers depend on the same abstract interfaces.

**Pros:**
- Minimal change surface — only `BaseJsonFileRepository` gains the cache dict and helpers; subclasses add 3–5 lines each
- Consistent with the `FingerprintFileRepository` pattern already in the codebase
- Zero changes to abstract interfaces or DI container

**Cons:**
- Subclasses must remember to call the helpers — a forgotten call silently bypasses caching
- Cache is per-instance, so multi-instance scenarios (uncommon in this DI-based design) won't share entries

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

### Approach 2: Decorator/Wrapper CachedRepository (Not Selected)

**Description:** Create a generic `CachedRepository[T]` decorator that wraps any `AbstractXxxRepository` and intercepts `load()`, `save()`, and `delete()`. The DI container would instantiate `CachedRepository(TemplateDiffsFileRepository(...))`.

**Pros / Cons:** Clean separation of concerns; no change to concrete classes. However it requires either one decorator per repository type (to satisfy typed abstract interfaces) or heavy generic wiring. The DI container must also be updated to wrap repositories on creation.

**Why not selected:** Higher complexity with no functional advantage over Approach 1. The repositories share a common base already; adding helpers there is simpler and consistent with the existing fingerprint cache pattern.

---

### Approach 3: Cache in DefaultContainer (Not Selected)

**Description:** The `DefaultContainer` stores a `dict[str, TemplateDiffsStorage]` alongside the repository, and the use-case layer checks the container cache before calling `load()`.

**Pros / Cons:** No change to repository classes. However it violates SRP by placing domain caching logic in the infrastructure container; it also leaks repository internals upward.

**Why not selected:** Architectural anti-pattern — caching is a repository concern, not a container concern.

---

## Selected Approach: Cache helpers in BaseJsonFileRepository

**Rationale:** Lowest complexity, smallest diff, consistent with the FingerprintFileRepository precedent already in the codebase. No interface changes means zero risk to callers.

---

## Implementation Tasks

### Task 1: Add `_cache` dict and helpers to `BaseJsonFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/base_json_repository.py`
- Test: `tests/unit/repositories/test_base_json_repository.py`

**Test cases:**
- ✅ Positive: after `_cache_put("t1", obj)`, `_cache_get("t1")` returns the same `obj`
- ✅ Positive: `_cache_get("missing")` returns `None` when cache is empty
- ✅ Positive: after `_cache_put("t1", obj)` then `_cache_invalidate("t1")`, `_cache_get("t1")` returns `None`
- ✅ Positive: `_cache_invalidate("nonexistent")` does not raise
- ✅ Positive: two different keys do not interfere — `_cache_put("t1", a)`, `_cache_put("t2", b)`, `_cache_get("t1")` returns `a`

**Test scaffold:**
```python
# Setup: no fixture needed — use a minimal concrete subclass of BaseJsonFileRepository
class _StubRepo(BaseJsonFileRepository[str]):
    def _log_deleted(self, template_name: str) -> None:
        pass

def test_cache_put_and_get(tmp_path: Path) -> None:
    repo = _StubRepo(tmp_path)
    repo._cache_put("t1", "value")
    assert repo._cache_get("t1") == "value"

def test_cache_invalidate(tmp_path: Path) -> None:
    repo = _StubRepo(tmp_path)
    repo._cache_put("t1", "value")
    repo._cache_invalidate("t1")
    assert repo._cache_get("t1") is None

def test_cache_invalidate_missing_key_no_error(tmp_path: Path) -> None:
    repo = _StubRepo(tmp_path)
    repo._cache_invalidate("nope")  # should not raise
```

**Implementation:**
```python
# In BaseJsonFileRepository.__init__, add:
self._in_memory_cache: dict[str, T] = {}

# Add three protected methods:
def _cache_get(self, key: str) -> T | None:
    return self._in_memory_cache.get(key)

def _cache_put(self, key: str, value: T) -> None:
    self._in_memory_cache[key] = value

def _cache_invalidate(self, key: str) -> None:
    self._in_memory_cache.pop(key, None)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Wire caching into `TemplateDiffsFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/template_diffs/file_repository.py`
- Test: `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`

**Test cases:**
- ✅ Positive: after `save("tpl", ...)`, a subsequent `load("tpl")` returns a `TemplateDiffsStorage` without re-reading the file (verify by monkeypatching `Path.read_text` to raise after first call — second `load` must still succeed)
- ✅ Positive: after `delete("tpl")`, `load("tpl")` raises `TemplateDiffNotFoundError` (cache was invalidated)
- ✅ Positive: two consecutive `load("tpl")` calls after a save return equal objects and only one disk read happens
- ✅ Positive: `load` on a file that was never saved still raises `TemplateDiffNotFoundError` (no stale cache entry)

**Test scaffold:**
```python
# Setup: repository fixture with tmp_path, no container needed
@pytest.fixture
def repo(tmp_path: Path) -> TemplateDiffsFileRepository:
    return TemplateDiffsFileRepository(storage_path=tmp_path)

def test_load_returns_cached_value(repo, monkeypatch, sample_position_index, sample_metadata):
    repo.save("tpl", sample_position_index, sample_metadata)
    # poison disk read to confirm second load uses cache
    monkeypatch.setattr(Path, "read_text", lambda *a, **kw: (_ for _ in ()).throw(OSError("no disk")))
    result = repo.load("tpl")
    assert isinstance(result, TemplateDiffsStorage)

def test_delete_invalidates_cache(repo, sample_position_index, sample_metadata):
    repo.save("tpl", sample_position_index, sample_metadata)
    repo.delete("tpl")
    with pytest.raises(TemplateDiffNotFoundError):
        repo.load("tpl")
```

**Implementation:**

In `TemplateDiffsFileRepository.load()`, before hitting disk:
```python
cached = self._cache_get(template_name)
if cached is not None:
    return cached
```
After successful deserialization, before `return`:
```python
self._cache_put(template_name, result)
return result
```

In `TemplateDiffsFileRepository.save()`, after writing to disk, store the decompressed object:
```python
self._cache_put(template_name, storage)
```
(Note: `storage` is the `TemplateDiffsStorage` object created by `self.compressor.compress(...)` — store it after assigning.)

In `BaseJsonFileRepository.delete()`, after `file_path.unlink()`:
```python
self._cache_invalidate(template_name)
```
(This is placed in the base class `delete()` so all subclasses benefit automatically.)

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Wire caching into `TemplateRulesFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/template_rules/file_repository.py`
- Test: `tests/unit/repositories/template_rules/test_template_rules_repository.py`

**Test cases:**
- ✅ Positive: after `save("tpl", rules)`, a subsequent `load("tpl")` returns a `RulesConfig` without reading disk (monkeypatch `Path.read_text` after first write)
- ✅ Positive: after `delete("tpl")`, `load("tpl")` raises `TemplateRulesNotFoundError`
- ✅ Positive: first `load` of a freshly-saved file succeeds and subsequent loads return cached result

**Test scaffold:**
```python
# Setup: repository fixture with tmp_path
@pytest.fixture
def repo(tmp_path: Path) -> TemplateRulesFileRepository:
    return TemplateRulesFileRepository(storage_path=tmp_path)

def test_load_cached_after_save(repo, monkeypatch, sample_rules_config):
    repo.save("tpl", sample_rules_config)
    monkeypatch.setattr(Path, "read_text", lambda *a, **kw: (_ for _ in ()).throw(OSError("no disk")))
    result = repo.load("tpl")
    assert result == sample_rules_config

def test_delete_invalidates_cache(repo, sample_rules_config):
    repo.save("tpl", sample_rules_config)
    repo.delete("tpl")
    with pytest.raises(TemplateRulesNotFoundError):
        repo.load("tpl")
```

**Implementation:**

In `TemplateRulesFileRepository.load()`, before hitting disk:
```python
cached = self._cache_get(template_name)
if cached is not None:
    return cached
```
After constructing `rules = RulesConfig(**data_dict)`, before `return rules`:
```python
self._cache_put(template_name, rules)
return rules
```

In `TemplateRulesFileRepository.save()`, after `file_path.write_text(...)`:
```python
self._cache_put(template_name, rules)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 4: Migrate `FingerprintFileRepository` to use base helpers (cleanup)

**Files:**
- Modify: `src/data_migrator/repositories/fingerprints/file_repository.py`
- Test: `tests/unit/repositories/fingerprints/test_fingerprint_repository.py`

**Context:** `FingerprintFileRepository` stores a single `_cache: FingerprintIndex | None` for its single-document pattern. After Task 1, the base class offers `_cache_get` / `_cache_put` / `_cache_invalidate`. Migrate this class to use those helpers (using a fixed key like `"__index__"`) to remove the duplicate caching implementation.

**Test cases:**
- ✅ Positive: existing fingerprint tests still pass after the refactor (no behavior change expected)
- ✅ Positive: `load_index()` returns same `FingerprintIndex` on repeated calls without re-reading disk (already tested; keep test to guard regression)
- ✅ Positive: `save_index(index)` stores the new index in cache — a subsequent `load_index()` returns the new value without re-reading disk

**Test scaffold:**
```python
# Setup: repo fixture using tmp_path (already in existing test file)
def test_load_index_uses_cache_after_save(repo, monkeypatch):
    from data_migrator.schemas.models.fingerprint import FingerprintIndex
    index = FingerprintIndex(entries=[])
    repo.save_index(index)
    monkeypatch.setattr(Path, "read_text", lambda *a, **kw: (_ for _ in ()).throw(OSError("no disk")))
    result = repo.load_index()
    assert result == index
```

**Implementation:**

Remove `self._cache: FingerprintIndex | None = None` from `__init__`.

In `load_index()`, replace:
```python
if self._cache is not None:
    return self._cache
...
self._cache = FingerprintIndex(entries=[])
...
self._cache = FingerprintIndex(**data)
```
with:
```python
_KEY = "__index__"

cached = self._cache_get(_KEY)
if cached is not None:
    return cached
...
index = FingerprintIndex(entries=[])
self._cache_put(_KEY, index)
...
index = FingerprintIndex(**data)
self._cache_put(_KEY, index)
```

In `save_index()`, replace `self._cache = index` with `self._cache_put(_KEY, index)`.

Note: `FingerprintFileRepository` does NOT extend `BaseJsonFileRepository` — it extends `AbstractFingerprintRepository` directly. Two options: (a) also make it extend `BaseJsonFileRepository` (structural change, out of scope), or (b) keep `_cache` as-is and skip this migration task. **Recommended: skip migration and leave FingerprintFileRepository unchanged.** This task is optional cleanup only; do not implement if it would require changing the inheritance hierarchy.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/repositories/base_json_repository.py:BaseJsonFileRepository` — shared base for template_diffs and template_rules repositories; this is where cache helpers live
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository._cache` — prior art for per-instance caching pattern

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/template_storage.py` — `TemplateDiffsStorage` is the cached type for diffs repository
- `src/data_migrator/schemas/models/rules.py` — `RulesConfig` is the cached type for rules repository

**Patterns to follow:**
- Repository tests use `tmp_path` pytest fixture and direct instantiation — no container required
- `monkeypatch` is the appropriate pytest tool to verify disk I/O is skipped
- `@timed` decorator on `load()` methods — leave in place; it wraps the method, not the cache check

**Test helpers to use:**
- Existing factory functions in `tests/unit/repositories/template_diffs/test_template_diffs_repository.py` (`create_test_position_index`, `create_test_metadata`) for arranging test data

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/repositories/ -v --cov=src/data_migrator/repositories
Coverage targets:
  - Critical paths (cache hit/miss/invalidate): >90%
  - Business logic (load/save/delete): >85%
```

### Code Quality

Delegate to `static-analyse` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Edge Cases to Test

- `_cache_invalidate` on a key that was never cached must not raise `KeyError`
- Cache stores the deserialized object returned from `save()` — ensures round-trip equality without an extra disk read
- After `delete()` in the base class, cache is cleared; subclass `load()` raises the correct domain error (not a stale hit)
- Calling `load()` on a template that does not exist on disk must not create a stale cache entry (i.e., the `TemplateDiffNotFoundError` path must not call `_cache_put`)

---

## Success Criteria

**Must have:**
- `BaseJsonFileRepository` exposes `_cache_get`, `_cache_put`, `_cache_invalidate` helpers
- `TemplateDiffsFileRepository.load()` returns cached object on second call without reading disk
- `TemplateRulesFileRepository.load()` returns cached object on second call without reading disk
- `save()` stores result in cache so the very next `load()` is a cache hit
- `delete()` (in base) invalidates cache entry so subsequent `load()` raises the correct not-found error
- All existing repository tests continue to pass (no behavior regression)
- Static analysis passes (ruff, mypy, radon MI≥A, CC≤B)

**Nice to have:**
- Optional: migrate `FingerprintFileRepository` to use base helpers (Task 4) if inheritance allows without structural changes
- Add `logger.debug("template_cache_hit", ...)` logging in `load()` methods for observability

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** N/A

**Memories Referenced:**
- `utility_classes` — checked for existing cache utilities; none found
- `architecture_patterns` — confirmed Repository pattern and DI container structure

**Similar Implementations:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` — serves as prior art for the `_cache` field pattern (single-object cache)
