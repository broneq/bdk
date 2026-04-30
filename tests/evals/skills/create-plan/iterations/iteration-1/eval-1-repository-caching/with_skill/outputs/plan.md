# Plan: In-Memory Caching for Repository Layer

**Created:** 2026-03-24
**Status:** Ready for implementation
**Goal:** Add in-memory caching to `TemplateDiffsFileRepository` and `TemplateRulesFileRepository` so repeated reads of the same template skip disk I/O, with cache invalidation on write and delete.
**Architecture:** A `CachingRepositoryMixin` decorator class wraps any concrete repository via composition, intercepting `load()` to serve from a `dict[str, T]` cache and invalidating the cache key on `save()` and `delete()`. The container wires the decorator transparently so callers receive the abstract interface unchanged.
**Complexity:** LOW

---

## Context

The `TemplateDiffsFileRepository.load()` and `TemplateRulesFileRepository.load()` methods hit disk on every call. During a migration run the same template is typically loaded multiple times (once for diffs, once for rules). Without caching, every call deserializes and decompresses the JSON file from disk.

The `FingerprintFileRepository` already uses an inline `_cache: FingerprintIndex | None` pattern for its single-file index. For multi-key repositories, a dedicated caching layer is cleaner and avoids duplicating cache logic in each concrete class.

The Decorator pattern fits naturally: the caching class implements the same abstract interface as the wrapped repository, stores results by `template_name` key, and delegates all calls to the wrapped instance. Cache invalidation happens when `save()` or `delete()` is called for a given `template_name`.

---

## Explored Approaches

### Approach 1: CachingRepository Decorator (Selected)

**Description:** A generic `CachingRepository[T]` class wraps any repository exposing `load(template_name)`, `save(template_name, ...)`, and `delete(template_name)` methods. It holds a `dict[str, T]` cache, serves `load()` hits from memory, and removes the cache key on `save()` / `delete()`. Wired in `DefaultContainer` around the concrete file repos.

**Pros:**
- Zero changes to existing concrete repositories (no risk of regressions)
- Cache logic in a single class — easy to unit test in isolation
- Easily toggled off (container can skip wrapping when needed, e.g. tests that assert disk behavior)

**Cons:**
- Requires wiring in `DefaultContainer` — two classes are instantiated instead of one
- Cache is per-repository-instance, not shared across container instances (acceptable for current use)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Create: `src/data_migrator/repositories/caching_mixin.py`
- Modify: `src/data_migrator/containers/base.py`
- Create: `tests/unit/repositories/test_caching_mixin.py`

---

### Approach 2: Extend BaseJsonFileRepository with Cache Hooks (Not Selected)

**Description:** Add `_cache: dict[str, T]` and hook methods `_cache_get()`, `_cache_set()`, `_cache_invalidate()` to `BaseJsonFileRepository`. Subclasses call these hooks inside their `save()` and `load()` overrides.

**Pros / Cons:** Keeps caching in the base class hierarchy; but mixes caching concerns into the base (SRP violation), and requires each subclass to remember to call hooks — a leaky contract.

**Why not selected:** Violates SRP — `BaseJsonFileRepository` already handles path sanitization and directory creation. Adding cache mechanics makes it a second responsibility. The hook approach is also error-prone for future subclasses.

---

### Approach 3: Inline Cache per Concrete Repository (Not Selected)

**Description:** Add `_cache: dict[str, T]` directly into `TemplateDiffsFileRepository` and `TemplateRulesFileRepository`, mirroring the `FingerprintFileRepository` inline pattern.

**Pros / Cons:** Consistent with existing `FingerprintFileRepository` pattern; but duplicates the same dict/invalidation logic in two classes. The fingerprint cache was justified because it manages a single whole-index object; per-key caching in two files is unnecessary duplication.

**Why not selected:** DRY violation — identical cache dicts and invalidation logic in two classes, with no abstraction to enforce correctness.

---

## Selected Approach: CachingRepository Decorator

**Rationale:** Keeps existing repositories unchanged (no regression risk), isolates cache logic in one testable class, and follows the Decorator pattern cleanly. The container transparently composes caching on top of file I/O without callers needing to know.

---

## Implementation Tasks

### Task 1: Create `CachingRepositoryMixin` for template diffs

**Files:**
- Create: `src/data_migrator/repositories/caching_mixin.py`
- Test: `tests/unit/repositories/test_caching_mixin.py`

**Test cases:**
- ✅ Positive: `load("X")` called twice → second call returns cached value, underlying repo called only once
- ✅ Positive: `load("X")` after `save("X", ...)` → re-loads from underlying repo (cache invalidated)
- ✅ Positive: `load("X")` after `delete("X")` → cache entry for "X" is removed; subsequent load hits underlying repo
- ✅ Positive: `load("A")` and `load("B")` → both cached independently; invalidating "A" does not affect "B"
- ❌ Negative: underlying repo raises `TemplateDiffNotFoundError` on `load()` → exception propagates, nothing cached

**Implementation:**

Create `src/data_migrator/repositories/caching_mixin.py`:

```python
"""Generic in-memory caching layer for template repositories."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Generic, TypeVar

import structlog

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()

T = TypeVar("T")


class CachedTemplateDiffsRepository:
    """Caching decorator for AbstractTemplateDiffsRepository.

    Wraps any AbstractTemplateDiffsRepository and serves load() results from
    memory on repeated calls. Cache is invalidated per template_name on save()
    and delete().
    """

    def __init__(self, wrapped: Any) -> None:
        self._wrapped = wrapped
        self._cache: dict[str, Any] = {}

    @property
    def storage_path(self) -> Any:
        return self._wrapped.storage_path

    def load(self, template_name: str) -> Any:
        """Load from cache or delegate to wrapped repository.

        Raises:
            TemplateDiffNotFoundError: If template does not exist.
            TemplateDiffLoadError: If load operation fails.
        """
        if template_name in self._cache:
            logger.debug("template_diffs_cache_hit", template_name=template_name)
            return self._cache[template_name]

        result = self._wrapped.load(template_name)
        self._cache[template_name] = result
        logger.debug("template_diffs_cache_miss", template_name=template_name)
        return result

    def save(self, template_name: str, *args: Any, **kwargs: Any) -> Any:
        """Save and invalidate cache for template_name.

        Raises:
            TemplateDiffSaveError: If save operation fails.
        """
        result = self._wrapped.save(template_name, *args, **kwargs)
        self._cache.pop(template_name, None)
        logger.debug("template_diffs_cache_invalidated", template_name=template_name)
        return result

    def delete(self, template_name: str) -> bool:
        result = self._wrapped.delete(template_name)
        self._cache.pop(template_name, None)
        return result

    def exists(self, template_name: str) -> bool:
        return self._wrapped.exists(template_name)

    def list_templates(self, filter_name: str | None = None) -> list[str]:
        return self._wrapped.list_templates(filter_name)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Create `CachedTemplateRulesRepository` for rules

**Files:**
- Modify: `src/data_migrator/repositories/caching_mixin.py` (add second class)
- Test: `tests/unit/repositories/test_caching_mixin.py` (add rules tests)

**Test cases:**
- ✅ Positive: `load("X")` called twice → second call returns cached value
- ✅ Positive: `save("X", rules)` invalidates cache; next `load("X")` hits underlying repo
- ✅ Positive: `delete("X")` invalidates cache for "X" only
- ❌ Negative: underlying repo raises `TemplateRulesNotFoundError` → exception propagates, nothing cached

**Implementation:**

Add to `src/data_migrator/repositories/caching_mixin.py`:

```python
class CachedTemplateRulesRepository:
    """Caching decorator for AbstractTemplateRulesRepository.

    Wraps any AbstractTemplateRulesRepository and serves load() results from
    memory on repeated calls. Cache is invalidated per template_name on save()
    and delete().
    """

    def __init__(self, wrapped: Any) -> None:
        self._wrapped = wrapped
        self._cache: dict[str, Any] = {}

    def load(self, template_name: str) -> Any:
        """Load from cache or delegate to wrapped repository.

        Raises:
            TemplateRulesNotFoundError: If rules do not exist.
            TemplateRulesLoadError: If load operation fails.
        """
        if template_name in self._cache:
            logger.debug("template_rules_cache_hit", template_name=template_name)
            return self._cache[template_name]

        result = self._wrapped.load(template_name)
        self._cache[template_name] = result
        logger.debug("template_rules_cache_miss", template_name=template_name)
        return result

    def save(self, template_name: str, *args: Any, **kwargs: Any) -> Any:
        """Save and invalidate cache for template_name.

        Raises:
            TemplateRulesSaveError: If save operation fails.
        """
        result = self._wrapped.save(template_name, *args, **kwargs)
        self._cache.pop(template_name, None)
        logger.debug("template_rules_cache_invalidated", template_name=template_name)
        return result

    def delete(self, template_name: str) -> bool:
        result = self._wrapped.delete(template_name)
        self._cache.pop(template_name, None)
        return result

    def exists(self, template_name: str) -> bool:
        return self._wrapped.exists(template_name)

    def list_templates(self, filter_name: str | None = None) -> list[str]:
        return self._wrapped.list_templates(filter_name)
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Wire caching decorators in `DefaultContainer`

**Files:**
- Modify: `src/data_migrator/containers/base.py`
- Test: `tests/unit/containers/test_base_container.py`

**Test cases:**
- ✅ Positive: `get_template_diffs_repository()` returns `CachedTemplateDiffsRepository` wrapping `TemplateDiffsFileRepository`
- ✅ Positive: `get_template_rules_repository()` returns `CachedTemplateRulesRepository` wrapping `TemplateRulesFileRepository`
- ✅ Positive: `set_template_diffs_repository(mock)` bypasses caching wrapper (mock is returned directly, as before)
- ✅ Positive: `get_template_diffs_repository()` called twice → same `CachedTemplateDiffsRepository` instance returned (container-level lazy caching)

**Implementation:**

In `src/data_migrator/containers/base.py`, update `get_template_diffs_repository()`:

```python
def get_template_diffs_repository(self) -> AbstractTemplateDiffsRepository:
    def factory() -> AbstractTemplateDiffsRepository:
        if self._template_diffs_repository is not None:
            return self._template_diffs_repository

        from data_migrator.repositories.caching_mixin import CachedTemplateDiffsRepository
        from data_migrator.repositories.template_diffs.file_repository import (
            TemplateDiffsFileRepository,
        )

        file_repo = TemplateDiffsFileRepository(
            storage_path=self._settings.template_diffs_storage_path
        )
        return CachedTemplateDiffsRepository(file_repo)

    return self._get_or_create("template_diffs_repository", factory)
```

Update `get_template_rules_repository()`:

```python
def get_template_rules_repository(self) -> AbstractTemplateRulesRepository:
    def factory() -> AbstractTemplateRulesRepository:
        if self._template_rules_repository is not None:
            return self._template_rules_repository

        from data_migrator.repositories.caching_mixin import CachedTemplateRulesRepository
        from data_migrator.repositories.template_rules.file_repository import (
            TemplateRulesFileRepository,
        )

        file_repo = TemplateRulesFileRepository(
            storage_path=self._settings.template_rules_storage_path
        )
        return CachedTemplateRulesRepository(file_repo)

    return self._get_or_create("template_rules_repository", factory)
```

Note: `CachedTemplateDiffsRepository` and `CachedTemplateRulesRepository` satisfy the duck-typed interface expected by callers; if stricter type-checking is needed, they can be made to explicitly implement the abstract base classes in a follow-up.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `repositories/base_json_repository.py:BaseJsonFileRepository` — base class for both file repositories
- `repositories/fingerprints/file_repository.py:FingerprintFileRepository` — inline `_cache` pattern as reference

**Relevant schemas/models:**
- `schemas/models/template_storage.py:TemplateDiffsStorage` — type returned by `TemplateDiffsFileRepository.load()`
- `schemas/models/rules.py:RulesConfig` — type returned by `TemplateRulesFileRepository.load()`

**Patterns to follow:**
- `FingerprintFileRepository._cache` — inline dict cache set on load, updated on save; same invalidation logic
- `DefaultContainer._get_or_create()` — lazy-init pattern used for all repository factory methods

**Test helpers to use:**
- Existing `conftest.py` fixtures: `tmp_path` (pytest built-in) for isolated storage paths
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py` — factory functions `create_test_position_index()`, `create_test_metadata()` can be imported or reused

---

## Verification

### Code Quality

Delegate to `static-analysis` subagent:
```
Run: bin/cleanup.sh
Must pass: ruff, mypy, radon (MI >= A, CC <= B)
```

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/repositories/test_caching_mixin.py tests/unit/containers/test_base_container.py -v --cov=src/data_migrator/repositories/caching_mixin
Coverage targets:
  - Critical paths: >90%
  - Business logic: >85%
```

### Edge Cases to Test

- `load()` after `save()` returns fresh data (not stale cached data)
- `delete()` for a key not in cache does not raise — `dict.pop(key, None)` handles this
- Two independent template names "A" and "B": saving "A" does not evict "B" from cache
- Underlying repo raises an exception on `load()` — exception propagates, cache remains unchanged for that key
- `set_template_diffs_repository(mock)` in container bypasses wrapper entirely (test override path is unaffected)

---

## Success Criteria

**Must have:**
- `load()` called N times for the same `template_name` results in exactly 1 disk read
- `save()` for a `template_name` causes the next `load()` to re-read from disk
- `delete()` for a `template_name` removes the cache entry
- All existing repository tests pass without modification
- Static analysis passes (ruff, mypy, radon MI >= A, CC <= B)
- Coverage meets thresholds

**Nice to have:**
- Add `cache_size()` method for observability / debugging (returns `len(self._cache)`)
- Log cache hit/miss counts at `DEBUG` level (already included in implementation above)

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None

**Memories Referenced:**
- `utility_classes` — confirmed no existing generic cache utility; `FingerprintFileRepository` inline pattern identified as reference
- `architecture_patterns` — not loaded (not needed; container wiring pattern is clear from code)

**Similar Implementations:**
- `repositories/fingerprints/file_repository.py:FingerprintFileRepository` — inline `_cache: FingerprintIndex | None` for single-object cache; serves as reference for invalidation approach
- `services/verification/axioms/extraction/v1_extractor.py:V1Extractor` — lazy-cached pattern for repeated extraction across axioms
