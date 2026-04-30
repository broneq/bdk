# Transcript Summary: create-plan for Repository In-Memory Caching

## Task
Add in-memory caching to the repository layer so repeated reads of the same file skip disk I/O. Cache should be invalidated on write.

## Phase 1: Setup
- Topic slug: `add-inmemory-cache-repository`
- Plan file: `docs/plans/2026-03-24-add-inmemory-cache-repository.md`
- Existing plan found at that path — overwritten per eval instructions (no interactive user to ask)
- No design docs found in `docs/designs/`

## Phase 2: Exploration (2 agents, executed inline)

### Files explored
- `src/data_migrator/repositories/base_json_repository.py` — generic base class `BaseJsonFileRepository[T]` with `delete()`, `exists()`, `list_templates()`, and abstract `_log_deleted()`
- `src/data_migrator/repositories/template_diffs/file_repository.py` — `TemplateDiffsFileRepository`: `load()` reads + decompresses JSON; `save()` compresses + writes; NO caching
- `src/data_migrator/repositories/template_rules/file_repository.py` — `TemplateRulesFileRepository`: similar pattern; NO caching
- `src/data_migrator/repositories/fingerprints/file_repository.py` — `FingerprintFileRepository`: ALREADY has `_cache: FingerprintIndex | None`, check-before-load, set-on-write pattern
- `src/data_migrator/containers/base.py` — `DefaultContainer` wires repositories; no changes needed

### Key findings
- `FingerprintFileRepository` provides the exact caching pattern to replicate
- Both `TemplateDiffsFileRepository` and `TemplateRulesFileRepository` extend `BaseJsonFileRepository` — ideal place to centralize caching
- `BaseJsonFileRepository.delete()` is the natural hook for cache eviction (already handles file removal)
- Tests exist at `tests/unit/repositories/` for all three repository types

## Phase 3: Design Decisions

Three approaches explored:
1. **Add caching to `BaseJsonFileRepository`** (Selected) — DRY, consistent, minimal change
2. **Caching Decorator / Wrapper** — OCP-compliant but excessive boilerplate for owned code
3. **Cache per concrete subclass** — duplicates logic across two files

Selected approach: Approach 1. Rationale: base class already owns deletion logic; centralizing caching here means both subclasses benefit with only 3 small method additions to the base and 2-line changes in each concrete `load()` and `save()`.

No user questions needed — clear path forward.

## Phase 4: Plan Written

3 tasks:
- Task 1: Add `_get_cached`, `_set_cached`, `_evict_cached` to `BaseJsonFileRepository`; wire `delete()` to call `_evict_cached`
- Task 2: Update `TemplateDiffsFileRepository.load()` and `save()` to use cache helpers
- Task 3: Update `TemplateRulesFileRepository.load()` and `save()` to use cache helpers

Files to modify: 3 source files + 3 test files
Files to create: 0

## Plan location
`/Users/przemyslawbroniszewski/PycharmProjects/or-migrator/docs/plans/2026-03-24-add-inmemory-cache-repository.md`
