# Transcript Summary: create-plan for In-Memory Repository Caching

## Task
Add in-memory caching to the repository layer so repeated reads of the same file skip disk I/O. Cache should be invalidated on write.

## Skill Executed
`create-plan` (SKILL.md at `.claude/skills/create-plan/SKILL.md`)

---

## Phase 1: Parse & Setup

- **Topic slug:** `add-inmemory-cache-repository` (chose unique name to avoid collision with existing plans `in-memory-caching-repository` and `repository-in-memory-caching`)
- **Plan file:** `docs/plans/2026-03-24-add-inmemory-cache-repository.md`
- No design docs found in `docs/designs/`
- Gate passed: valid input, plan path confirmed non-existent

---

## Phase 2: Exploration

**Scope determination:** Medium (cross-file, multiple components in repository layer)

**Agent 1 findings (Utilities & Existing Implementations):**
- `FingerprintFileRepository` at `src/data_migrator/repositories/fingerprints/file_repository.py` already uses `self._cache: FingerprintIndex | None = None` — exact reference pattern
- `BaseJsonFileRepository[T]` at `src/data_migrator/repositories/base_json_repository.py` is the shared base class for both `TemplateDiffsFileRepository` and `TemplateRulesFileRepository`
- `@timed` decorator used on all `load()` methods

**Agent 2 findings (Architecture & Dependencies):**
- **Affected layers:** Repository layer only (no use-case or service changes needed)
- **Affected files:**
  - `src/data_migrator/repositories/base_json_repository.py` — add cache dict + helpers
  - `src/data_migrator/repositories/template_diffs/file_repository.py` — wire cache in `load()`/`save()`
  - `src/data_migrator/repositories/template_rules/file_repository.py` — wire cache in `load()`/`save()`
- **Test patterns:** Classes grouping tests by method, `ConcreteRepository` test double, `tmp_path` fixture
- **Architectural constraints:** Follow SRP, OCP — base class owns cache state, subclasses remain unchanged in interface

**Exploration summary:**
- Utilities: 3 found
- Affected files: 5 found (3 source + 2 test)
- Similar features: 1 found (FingerprintFileRepository._cache)

---

## Phase 3: Design Decisions

Three approaches explored:

1. **Add `_cache` dict to `BaseJsonFileRepository`** — SELECTED
   - Lowest complexity, zero new files, mirrors fingerprint repo pattern
   - Cache helpers: `_get_cache`, `_put_cache`, `_evict_cache`, `clear_cache`
   - `delete()` gets `_evict_cache` call; `load()` checks cache first; `save()` evicts/updates

2. **`CachingRepositoryDecorator` wrapper** — rejected (more code, 3 decorator classes, container re-wiring)

3. **`CachedRepositoryMixin`** — rejected (unnecessary second inheritance chain; base class approach is simpler)

Decision made without user questions (`Clear path forward - proceeding without questions`).

---

## Phase 4: Plan Written

**Plan:** `docs/plans/2026-03-24-add-inmemory-cache-repository.md`

**Tasks:**
1. Add `_cache` dict + helpers (`_get_cache`, `_put_cache`, `_evict_cache`, `clear_cache`) to `BaseJsonFileRepository`; update `delete()` to evict
2. Wire cache into `TemplateDiffsFileRepository.load()` (check) and `save()` (evict)
3. Wire cache into `TemplateRulesFileRepository.load()` (check + populate) and `save()` (update)

Each task follows TDD: write failing test → implement → verify passing → commit.

**Files to modify:** 3 source files, 3 test files
**Files to create:** 0

---

## Phase 5: Summary

```
[create-plan] Done.

  Plan:        docs/plans/2026-03-24-add-inmemory-cache-repository.md
  Approach:    Add _cache dict to BaseJsonFileRepository
  Complexity:  LOW
  Tasks:       3 implementation tasks
  Files:       3 to modify, 0 to create
```

---

## Key Findings

- **Existing pattern:** `FingerprintFileRepository` already implements the exact caching pattern needed — `_cache` field, check-before-disk in `load_index()`, update-on-save in `save_index()`. The plan follows this established convention.
- **No interface changes:** Abstract base classes (`AbstractTemplateDiffsRepository`, `AbstractTemplateRulesRepository`) do not need changes. Cache is an internal implementation detail.
- **Cache eviction strategy:** `save()` evicts for `TemplateDiffsFileRepository` (compression makes it safer to force re-load), but updates for `TemplateRulesFileRepository` (plain Pydantic model, safe to cache directly after write).
- **`delete()` already handled:** Base class `delete()` is the right place to add `_evict_cache()` — centralised in one place, both repos benefit.
