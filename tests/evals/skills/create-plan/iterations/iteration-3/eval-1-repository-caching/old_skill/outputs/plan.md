# Plan: Add In-Memory Caching to Repository Layer

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Add in-memory caching to `BaseJsonFileRepository` so repeated `load()` calls for the same template skip disk I/O, with cache invalidation on `save()` and `delete()`.
**Architecture:** Extend `BaseJsonFileRepository[T]` with a `dict[str, T]` cache. The `load()` method checks the cache first; `save()` populates the cache on success; `delete()` evicts the entry. Subclasses (`TemplateDiffsFileRepository`, `TemplateRulesFileRepository`) require no changes. A `clear_cache()` method provides test ergonomics and manual invalidation.
**Complexity:** LOW

---

## Context

The OR migrator loads template diffs and template rules from JSON files on disk. During a migration run, the same template is loaded multiple times (once per migration use case call). Currently every `load()` call hits disk, parses JSON, and decompresses the result — work that is identical for the same `template_name` within a single process lifetime.

The codebase already has an established pattern for this: `FingerprintFileRepository` (in `src/data_migrator/repositories/fingerprints/file_repository.py`) uses `self._cache: FingerprintIndex | None = None`, sets it on load, and updates it on save. The same pattern can be applied to the generic `BaseJsonFileRepository[T]` so all file repositories inherit it without duplicating code.

The change is entirely internal to the repository layer. No use cases, services, or schemas are affected. Cache lifetime is tied to the repository instance, which is scoped to a single CLI command invocation via `DefaultContainer`.

---

## Explored Approaches

### Approach 1: Add `_cache` dict to `BaseJsonFileRepository` (Selected)

**Description:** Add `self._cache: dict[str, T]` to `BaseJsonFileRepository.__init__`. Override abstract hooks so subclasses can call `super().save(...)` and `super().load(...)` at the base level. Add concrete `_put_cache`, `_get_cache`, `_evict_cache`, and `clear_cache` methods. The `TemplateDiffsFileRepository.save()` and `.load()` methods call these helpers inline (no interface change).

**Design pattern:** Template Method — base class manages cache state; subclasses own domain-specific serialisation.

**OO principles:** SRP (base class owns cache lifecycle), OCP (subclasses don't change), DIP (callers depend on abstract, not concrete).

**Pros:**
- Zero new files — change is in one class, all repositories inherit the benefit
- Follows the established `FingerprintFileRepository._cache` pattern already in the codebase
- Subclasses remain unchanged for cache reads (they call `_get_cache`/`_put_cache` instead of touching `_cache` directly)

**Cons:**
- Tightly couples caching to the base class (can't enable per-repository)
- Cache is unbounded in memory — acceptable for this domain (templates are O(10s) of files, each < 1 MB)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Modify: `src/data_migrator/repositories/base_json_repository.py`
- Modify: `src/data_migrator/repositories/template_diffs/file_repository.py`
- Modify: `src/data_migrator/repositories/template_rules/file_repository.py`
- Modify: `tests/unit/repositories/test_base_json_repository.py`
- Modify: `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`
- Modify: `tests/unit/repositories/template_rules/test_template_rules_repository.py`

---

### Approach 2: `CachingRepositoryDecorator` wrapper (Not Selected)

**Description:** Create per-abstract-interface decorator classes (e.g., `CachingTemplateDiffsRepository`) that wrap a concrete file repository, intercept `load()` and `save()`, and maintain a `dict` cache.

**Pros / Cons:** Clean separation — caching is explicit at the composition site. But requires one decorator class per abstract interface (3 decorators), more code, more tests, and the container must be wired to wrap the concrete with the decorator.

**Why not selected:** Higher code volume for the same result. The base class approach is simpler and follows the existing fingerprint caching convention.

---

### Approach 3: `CachedRepositoryMixin` (Not Selected)

**Description:** A standalone mixin class with `_cache: dict[str, Any]` and methods `_put_cache`, `_get_cache`, `_evict_cache`. Each file repository class inherits from both the mixin and `BaseJsonFileRepository`.

**Why not selected:** Mixin adds a second inheritance chain for a feature that the base class can already own. Python MRO is harder to reason about than a single base class with the dictionary built in.

---

## Selected Approach: Add `_cache` dict to `BaseJsonFileRepository`

**Rationale:** Lowest complexity, zero new files, follows existing `FingerprintFileRepository._cache` convention. Cache helpers on the base class keep domain-specific subclasses unchanged. Risk is minimal since cache entries are keyed by sanitised template name and invalidated on every write/delete.

---

## Implementation Tasks

### Task 1: Add cache infrastructure to `BaseJsonFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/base_json_repository.py`
- Test: `tests/unit/repositories/test_base_json_repository.py`

**Test cases:**
- ✅ Positive: given `ConcreteRepository`, calling `_put_cache("tmpl", {"v": 1})` then `_get_cache("tmpl")` returns `{"v": 1}`
- ✅ Positive: given cache populated with `"tmpl"`, calling `_evict_cache("tmpl")` then `_get_cache("tmpl")` returns `None`
- ✅ Positive: given cache populated with two entries, `clear_cache()` leaves `_get_cache` returning `None` for both
- ✅ Positive: `_get_cache("nonexistent")` returns `None` (no KeyError)

**Implementation:**

Add to `BaseJsonFileRepository.__init__`:
```python
self._cache: dict[str, T] = {}
```

Add three helper methods and a public `clear_cache()`:
```python
def _get_cache(self, template_name: str) -> T | None:
    return self._cache.get(template_name)

def _put_cache(self, template_name: str, value: T) -> None:
    self._cache[template_name] = value

def _evict_cache(self, template_name: str) -> None:
    self._cache.pop(template_name, None)

def clear_cache(self) -> None:
    """Evict all cached entries."""
    self._cache.clear()
```

Also update `delete()` to call `self._evict_cache(template_name)` after a successful file deletion:
```python
def delete(self, template_name: str) -> bool:
    file_path = self._get_file_path(template_name)
    if file_path.exists():
        file_path.unlink()
        self._evict_cache(template_name)
        self._log_deleted(template_name)
        return True
    return False
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Wire caching into `TemplateDiffsFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/template_diffs/file_repository.py`
- Test: `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`

**Test cases:**
- ✅ Positive: given `TemplateDiffsFileRepository`, calling `load("gencon1994")` twice with the file present — the second call returns the same object (identity check `is`) without additional disk reads (mock `Path.read_text` called exactly once)
- ✅ Positive: given a cached entry for `"gencon1994"`, calling `save("gencon1994", ...)` then `load("gencon1994")` returns the newly saved data (cache updated, not stale)
- ✅ Positive: given a cached entry for `"gencon1994"`, calling `delete("gencon1994")` then `load("gencon1994")` raises `TemplateDiffNotFoundError` (cache evicted)
- ❌ Negative: given no file and empty cache, `load("missing")` raises `TemplateDiffNotFoundError`

**Implementation:**

In `TemplateDiffsFileRepository.load()`, add cache check at the top and cache population at the end:
```python
@timed
def load(self, template_name: str) -> TemplateDiffsStorage:
    """Load template position index data.

    Raises:
        TemplateDiffNotFoundError: If file doesn't exist.
        TemplateDiffLoadError: If load operation fails.
    """
    cached = self._get_cache(template_name)
    if cached is not None:
        return cached

    from data_migrator.schemas.models.template_storage import CompressedTemplateDiffsStorage

    file_path = self._get_file_path(template_name)

    if not file_path.exists():
        raise TemplateDiffNotFoundError(f"No template found for '{template_name}'")

    try:
        data_dict = json.loads(file_path.read_text(encoding="utf-8"))
        compressed = CompressedTemplateDiffsStorage(**data_dict)
        result = self.compressor.decompress(compressed)
        self._put_cache(template_name, result)
        return result

    except OSError as e:
        logger.error("template_read_failed", error=str(e), path=str(file_path))
        raise TemplateDiffLoadError(f"Failed to read from {file_path}: {e}") from e
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("template_parse_failed", error=str(e), path=str(file_path))
        raise TemplateDiffLoadError(f"Failed to parse template: {e}") from e
```

In `TemplateDiffsFileRepository.save()`, after the successful `file_path.write_text(...)` call, add:
```python
self._evict_cache(template_name)
```
(Evict on save rather than update, because the save goes through compression — it's simpler and safer to force a fresh load on next access than to try to store the decompressed form here.)

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Wire caching into `TemplateRulesFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/template_rules/file_repository.py`
- Test: `tests/unit/repositories/template_rules/test_template_rules_repository.py`

**Test cases:**
- ✅ Positive: given `TemplateRulesFileRepository`, calling `load("gencon1994")` twice — `Path.read_text` called exactly once (cached on first call)
- ✅ Positive: given a cached entry for `"gencon1994"`, calling `save("gencon1994", updated_rules)` then `load("gencon1994")` returns `updated_rules` (cache evicted, disk re-read)
- ✅ Positive: given a cached entry for `"gencon1994"`, calling `delete("gencon1994")` then checking `exists("gencon1994")` returns `False`
- ❌ Negative: given no file and empty cache, `load("missing")` raises `TemplateRulesNotFoundError`

**Implementation:**

In `TemplateRulesFileRepository.load()`, add cache check and population:
```python
@timed
def load(self, template_name: str) -> RulesConfig:
    """Load rules for a template.

    Raises:
        TemplateRulesNotFoundError: If rules don't exist.
        TemplateRulesLoadError: If load operation fails.
    """
    cached = self._get_cache(template_name)
    if cached is not None:
        return cached

    file_path = self._get_file_path(template_name)

    if not file_path.exists():
        raise TemplateRulesNotFoundError(f"No rules found for '{template_name}'")

    try:
        data_dict = json.loads(file_path.read_text(encoding="utf-8"))
        rules = RulesConfig(**data_dict)

        logger.debug(
            "template_rules_loaded",
            template_name=template_name,
            rule_count=len(rules.rules),
            file_path=str(file_path),
        )
        self._put_cache(template_name, rules)
        return rules

    except OSError as e:
        logger.error("template_rules_read_failed", error=str(e), path=str(file_path))
        raise TemplateRulesLoadError(f"Failed to read from {file_path}: {e}") from e
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("template_rules_parse_failed", error=str(e), path=str(file_path))
        raise TemplateRulesLoadError(f"Failed to parse rules: {e}") from e
```

In `TemplateRulesFileRepository.save()`, after the successful `file_path.write_text(...)` call, add:
```python
self._put_cache(template_name, rules)
```
(Rules are not compressed — we can cache the value directly after save.)

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` - reference pattern for `_cache` field + invalidation on `save_index`

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/template_storage.py` - `TemplateDiffsStorage` (the cached type for template diffs)
- `src/data_migrator/schemas/models/rules.py` - `RulesConfig` (the cached type for template rules)

**Patterns to follow:**
- `FingerprintFileRepository._cache`: `T | None` initialized to `None`, checked before disk, set after load, set on save
- `BaseJsonFileRepository._get_file_path`: shows how to sanitise template names consistently

**Test helpers to use:**
- `tests/unit/repositories/test_base_json_repository.py:ConcreteRepository` - reusable concrete test double for `BaseJsonFileRepository`
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py:create_test_position_index` - factory for `DocumentPositionIndex`

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/repositories/ -v --cov=src/data_migrator/repositories
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

### Edge Cases to Test

- Calling `load()` on a template name that fails mid-parse (e.g., corrupted JSON) — must NOT cache the failed result
- Calling `delete()` on a template name that is not in cache — must not raise KeyError (use `dict.pop(..., None)`)
- Calling `clear_cache()` on an empty cache — must be a no-op (no exception)
- Two different template names cached — evicting one must not affect the other

---

## Success Criteria

**Must have:**
- `BaseJsonFileRepository` has `_cache: dict[str, T]` with `_get_cache`, `_put_cache`, `_evict_cache`, `clear_cache` methods
- `TemplateDiffsFileRepository.load()` returns cached result on second call without re-reading disk
- `TemplateRulesFileRepository.load()` returns cached result on second call without re-reading disk
- `save()` invalidates or updates cache so next `load()` reflects the written data
- `delete()` evicts cache entry so next `load()` raises `*NotFoundError`
- All new cache tests pass
- Static analysis passes (ruff, mypy, radon)
- No existing tests broken

**Nice to have:**
- Log a `cache_hit` debug event when returning from cache (useful for performance profiling)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** N/A

**Memories Referenced:**
- N/A (patterns read directly from code)

**Similar Implementations:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` - in-memory `_cache` pattern with invalidation on `save_index`
- `src/data_migrator/containers/base.py:BaseContainer._get_or_create` - scope-keyed dict cache pattern showing cache lifecycle in this codebase
