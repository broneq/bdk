# Plan: Repository In-Memory Caching

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Add per-instance dict caches to `TemplateDiffsFileRepository` and `TemplateRulesFileRepository` so repeated `load()` calls skip disk I/O, with cache invalidation on `save()` and `delete()`.
**Architecture:** Each concrete repository holds a `dict[str, T]` keyed by `template_name`. `load()` checks the dict before reading disk; `save()` and `delete()` evict the matching key. No base-class changes are needed — this follows the existing pattern already established in `FingerprintFileRepository`.
**Complexity:** LOW

---

## Context

The project has three file-based JSON repositories: `TemplateDiffsFileRepository`, `TemplateRulesFileRepository`, and `FingerprintFileRepository`. Each stores per-template data as a `.json` file on disk.

`FingerprintFileRepository` already carries a `self._cache: FingerprintIndex | None = None` for its single-file data. The other two repositories have no caching — every `load()` call touches disk even if the same template was just loaded. During a migration run, `load()` is called once per document for the same template, so the win is real but small per run. For batch runs or tests that exercise many migrations, the savings compound.

The natural implementation is a per-instance `dict[str, TemplateDiffsStorage]` and `dict[str, RulesConfig]` cache, consistent with the `FingerprintFileRepository` pattern. Cache invalidation happens in `save()` and `delete()` by removing the entry for that template name. No TTL or LRU is needed — the files only change when the application explicitly writes them.

---

## Explored Approaches

### Approach 1: Per-Instance Dict Cache in Concrete Repositories (Selected)

**Description:** Add a `_cache: dict[str, T]` field to `TemplateDiffsFileRepository` and `TemplateRulesFileRepository`. `load()` checks the dict first; `save()` and `delete()` evict the key. This mirrors the existing `FingerprintFileRepository` pattern and requires no structural changes to the base class or abstract interfaces.

**Design pattern:** Simple instance-level cache (no design pattern overhead)
**OO principles:** SRP — each repo manages its own state; OCP — no base class modifications; DIP — no new abstractions

**Pros:**
- Follows established pattern already in `FingerprintFileRepository`
- Zero changes to base class or abstract interfaces
- Minimal complexity — plain dict operations

**Cons:**
- Cache is per-instance, so two instances of the same repo don't share cache (acceptable for this codebase — repos are singletons via DI container)
- No eviction policy — cache grows unbounded (acceptable: templates are small, set is finite)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- `src/data_migrator/repositories/template_diffs/file_repository.py`
- `src/data_migrator/repositories/template_rules/file_repository.py`
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`
- `tests/unit/repositories/template_rules/test_template_rules_repository.py`

---

### Approach 2: Cache Helpers in BaseJsonFileRepository (Not Selected)

**Description:** Add protected `_cache_get(name)` / `_cache_set(name, value)` / `_cache_evict(name)` methods to `BaseJsonFileRepository` backed by a generic `dict[str, Any]`. Concrete repos call helpers instead of direct dict access.

**Pros / Cons:** Centralises cache logic; but introduces `Any` typing in generic base or requires complex generics. The benefit is marginal since only two classes need this.

**Why not selected:** Increases base-class complexity for minimal gain. The `FingerprintFileRepository` doesn't even extend `BaseJsonFileRepository`, so sharing via the base class wouldn't cover all repos consistently.

---

### Approach 3: Decorator-Based Caching (Not Selected)

**Description:** Wrap `load()` with a `@cached_method` decorator that introspects `template_name` argument and stores results in a per-instance `__cache__` dict. `save()` and `delete()` call a corresponding `@invalidates_cache` decorator.

**Pros / Cons:** DRY across many classes; but requires descriptor/metaclass machinery, is harder to understand, and the benefit doesn't justify the complexity for only two classes.

**Why not selected:** Over-engineered for 2 classes. KISS principle applies.

---

## Selected Approach: Per-Instance Dict Cache in Concrete Repositories

**Rationale:** Simplest solution that works. Follows existing `FingerprintFileRepository` pattern. Zero risk of regressions in base class or other components. Each repository stays self-contained. Can be extended later to share a class-level cache or add LRU if profiling shows need.

---

## Implementation Tasks

### Task 1: Add in-memory cache to `TemplateDiffsFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/template_diffs/file_repository.py`
- Test: `tests/unit/repositories/template_diffs/test_template_diffs_repository.py`

**Test cases:**
- ✅ Positive: given a `TemplateDiffsFileRepository` and one `save()` followed by two `load()` calls for `"GENCON1994"`, the `Path.read_text` is called only once (disk read happens once; second load hits cache)
- ✅ Positive: given a repo where `"GENCON1994"` was loaded, calling `save("GENCON1994", ...)` evicts the cache entry so the next `load("GENCON1994")` reads from disk again
- ✅ Positive: given a repo where `"GENCON1994"` was loaded, calling `delete("GENCON1994")` evicts the cache entry so `_cache` no longer contains `"GENCON1994"`
- ✅ Positive: given two different template names `"A"` and `"B"` both loaded, deleting `"A"` evicts only `"A"` from cache; `"B"` remains cached

**Test scaffold:**
```python
# Setup: no fixture (uses tmp_path and monkeypatch)

def test_load_reads_disk_only_once(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    # arrange
    repo = TemplateDiffsFileRepository(storage_path=tmp_path)
    position_index = create_test_position_index(name="GENCON1994")
    metadata = create_test_metadata()
    repo.save("GENCON1994", position_index, metadata)
    read_count = 0
    original_read_text = Path.read_text
    def counting_read_text(self: Path, *args: object, **kwargs: object) -> str:
        nonlocal read_count
        read_count += 1
        return original_read_text(self, *args, **kwargs)
    monkeypatch.setattr(Path, "read_text", counting_read_text)
    # act
    repo.load("GENCON1994")
    repo.load("GENCON1994")
    # assert
    assert read_count == 1

def test_save_evicts_cache_entry(tmp_path: Path) -> None:
    # arrange
    repo = TemplateDiffsFileRepository(storage_path=tmp_path)
    position_index = create_test_position_index(name="GENCON1994")
    metadata = create_test_metadata()
    repo.save("GENCON1994", position_index, metadata)
    repo.load("GENCON1994")  # populate cache
    # act
    repo.save("GENCON1994", position_index, metadata)
    # assert
    assert "GENCON1994" not in repo._cache

def test_delete_evicts_cache_entry(tmp_path: Path) -> None:
    # arrange
    repo = TemplateDiffsFileRepository(storage_path=tmp_path)
    position_index = create_test_position_index(name="GENCON1994")
    metadata = create_test_metadata()
    repo.save("GENCON1994", position_index, metadata)
    repo.load("GENCON1994")  # populate cache
    # act
    repo.delete("GENCON1994")
    # assert
    assert "GENCON1994" not in repo._cache

def test_delete_evicts_only_targeted_template(tmp_path: Path) -> None:
    # arrange
    repo = TemplateDiffsFileRepository(storage_path=tmp_path)
    for name in ["A", "B"]:
        idx = create_test_position_index(name=name)
        repo.save(name, idx, create_test_metadata())
        repo.load(name)
    # act
    repo.delete("A")
    # assert
    assert "A" not in repo._cache
    assert "B" in repo._cache
```

**Implementation:**

Add `_cache: dict[str, TemplateDiffsStorage]` in `__init__`:
```python
def __init__(self, storage_path: Path, compressor: PositionIndexCompressor | None = None) -> None:
    super().__init__(storage_path)
    self.compressor = compressor or PositionIndexCompressor()
    self._cache: dict[str, TemplateDiffsStorage] = {}
```

In `load()`, check cache before disk read:
```python
@timed
def load(self, template_name: str) -> TemplateDiffsStorage:
    if template_name in self._cache:
        return self._cache[template_name]
    # ... existing disk read logic ...
    result = self.compressor.decompress(compressed)
    self._cache[template_name] = result
    return result
```

In `save()`, evict after successful write:
```python
def save(self, template_name: str, ...) -> Path:
    # ... existing write logic ...
    self._cache.pop(template_name, None)
    return file_path
```

Override `delete()` in `TemplateDiffsFileRepository` to also evict (base class handles disk delete, but doesn't know about cache):
```python
def delete(self, template_name: str) -> bool:
    result = super().delete(template_name)
    self._cache.pop(template_name, None)
    return result
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Add in-memory cache to `TemplateRulesFileRepository`

**Files:**
- Modify: `src/data_migrator/repositories/template_rules/file_repository.py`
- Test: `tests/unit/repositories/template_rules/test_template_rules_repository.py`

**Test cases:**
- ✅ Positive: given a `TemplateRulesFileRepository` and one `save()` followed by two `load()` calls for `"GENCON1994"`, `Path.read_text` is called only once
- ✅ Positive: given a repo where `"GENCON1994"` was loaded, calling `save("GENCON1994", rules)` evicts `"GENCON1994"` from cache so next `load()` reads disk
- ✅ Positive: given a repo where `"GENCON1994"` was loaded, calling `delete("GENCON1994")` removes it from cache
- ✅ Positive: given two templates `"A"` and `"B"` both cached, saving `"A"` evicts only `"A"`; `"B"` stays cached

**Test scaffold:**
```python
# Setup: uses tmp_path and monkeypatch; existing sample_rules_config fixture reused

def test_rules_load_reads_disk_only_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, sample_rules_config: RulesConfig
) -> None:
    # arrange
    repo = TemplateRulesFileRepository(storage_path=tmp_path)
    repo.save("GENCON1994", sample_rules_config)
    read_count = 0
    original_read_text = Path.read_text
    def counting_read_text(self: Path, *args: object, **kwargs: object) -> str:
        nonlocal read_count
        read_count += 1
        return original_read_text(self, *args, **kwargs)
    monkeypatch.setattr(Path, "read_text", counting_read_text)
    # act
    repo.load("GENCON1994")
    repo.load("GENCON1994")
    # assert
    assert read_count == 1

def test_rules_save_evicts_cache_entry(
    tmp_path: Path, sample_rules_config: RulesConfig
) -> None:
    # arrange
    repo = TemplateRulesFileRepository(storage_path=tmp_path)
    repo.save("GENCON1994", sample_rules_config)
    repo.load("GENCON1994")  # populate cache
    # act
    repo.save("GENCON1994", sample_rules_config)
    # assert
    assert "GENCON1994" not in repo._cache

def test_rules_delete_evicts_cache_entry(
    tmp_path: Path, sample_rules_config: RulesConfig
) -> None:
    # arrange
    repo = TemplateRulesFileRepository(storage_path=tmp_path)
    repo.save("GENCON1994", sample_rules_config)
    repo.load("GENCON1994")
    # act
    repo.delete("GENCON1994")
    # assert
    assert "GENCON1994" not in repo._cache

def test_rules_save_evicts_only_targeted_template(
    tmp_path: Path, sample_rules_config: RulesConfig
) -> None:
    # arrange
    repo = TemplateRulesFileRepository(storage_path=tmp_path)
    for name in ["A", "B"]:
        repo.save(name, sample_rules_config)
        repo.load(name)
    # act
    repo.save("A", sample_rules_config)
    # assert
    assert "A" not in repo._cache
    assert "B" in repo._cache
```

**Implementation:**

Add `_cache: dict[str, RulesConfig]` in `__init__` (introduce explicit `__init__` since none exists):
```python
def __init__(self, storage_path: Path) -> None:
    super().__init__(storage_path)
    self._cache: dict[str, RulesConfig] = {}
```

In `load()`:
```python
@timed
def load(self, template_name: str) -> RulesConfig:
    if template_name in self._cache:
        return self._cache[template_name]
    # ... existing disk read logic ...
    rules = RulesConfig(**data_dict)
    self._cache[template_name] = rules
    return rules
```

In `save()`, evict after write:
```python
def save(self, template_name: str, rules: RulesConfig) -> Path:
    # ... existing write logic ...
    self._cache.pop(template_name, None)
    return file_path
```

Override `delete()`:
```python
def delete(self, template_name: str) -> bool:
    result = super().delete(template_name)
    self._cache.pop(template_name, None)
    return result
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` - Already implements per-instance cache with `_cache` field and invalidation on write; serves as the pattern to follow

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/template_storage.py` - Defines `TemplateDiffsStorage` (the cached type for task 1)
- `src/data_migrator/schemas/models/rules.py` - Defines `RulesConfig` (the cached type for task 2)

**Patterns to follow:**
- `FingerprintFileRepository._cache` pattern: check before read, assign after deserialize, evict on write
- `dict.pop(key, None)` for safe eviction without KeyError

**Test helpers to use:**
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py:create_test_position_index` - factory for test data
- `tests/unit/repositories/template_diffs/test_template_diffs_repository.py:create_test_metadata` - factory for metadata
- `tests/unit/repositories/template_rules/test_template_rules_repository.py:sample_rules_config` - pytest fixture for rules

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/repositories/template_diffs/test_template_diffs_repository.py tests/unit/repositories/template_rules/test_template_rules_repository.py -v --cov=src/data_migrator/repositories
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

- Delete a template that was never loaded (cache miss eviction — `pop(key, None)` must not raise)
- Load a template that was saved, deleted, then re-saved — should serve fresh data from disk after second save
- Two repository instances pointing to the same directory — each has independent cache (no cross-instance pollution)

---

## Success Criteria

**Must have:**
- `TemplateDiffsFileRepository.load()` returns cached result on second call without touching disk
- `TemplateRulesFileRepository.load()` returns cached result on second call without touching disk
- `save()` on either repo evicts only the saved template's cache entry
- `delete()` on either repo evicts only the deleted template's cache entry
- All existing repository tests continue to pass
- Static analysis passes

**Nice to have:**
- Log a `cache_hit` event at `logger.debug` level to aid performance profiling

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** None found in `docs/designs/`

**Memories Referenced:**
- `utility_classes` — checked `FingerprintFileRepository` as existing cache reference
- `code_style_and_conventions` — dict operations, `pop(key, None)` idiom

**Similar Implementations:**
- `src/data_migrator/repositories/fingerprints/file_repository.py:FingerprintFileRepository` - per-instance cache with `_cache` field; serves as the direct implementation template
