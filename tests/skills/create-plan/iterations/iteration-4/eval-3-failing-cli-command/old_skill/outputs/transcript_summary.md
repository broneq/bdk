# Transcript Summary: create-plan for addition_position_preserved Fix

## Task
Fix a validation failure in `addition_position_preserved` when running:
```
uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
```

## Phase 1: Parse & Setup

**Slug chosen:** `fix-addition-position-preserved-validation`

**Plan file path:** `docs/plans/2026-03-24-fix-addition-position-preserved-validation.md`

During setup, two existing plans were found related to this area:
- `2026-03-24-fix-addition-position-preserved-axiom.md` — addresses stale XML path resolution (FileNotFoundError *before* the axiom runs). Different failure mode.
- `2026-03-24-fix-addition-position-preserved-validation.md` — addresses the actual axiom matching failure (error *during* validation in `addition_position_preserved`). This matches the task description.

The second plan was selected as the output because it directly addresses the described failure scenario.

No design docs found in `docs/designs/`.

## Phase 2: Exploration (2 agents dispatched — Medium scope)

**Why 2 agents (not 1 or 3):**
The SKILL.md specifies:
- Simple (single function/class, localized): 1 agent
- Medium (cross-file, multiple components): 2 agents
- Complex (architectural change, new subsystem): 3 agents

This fix touches multiple components across 3+ files: `ContextMatcher`, `PositionValidationPipeline`, `PositionPreservedAxiom`, and integration with `VerificationContext`. Scope = Medium → 2 agents.

**Agent 1 (Utilities & Existing Implementations):** Found existing fallback pattern in `ContextMatcher` (`_try_merged_addition_fallback`, `_try_cross_directional_match`). Identified reusable: `PositionAxiomFactory`, `MatchDetail`, `ChangeWithContext`. Found test pattern in `test_axiom.py`.

**Agent 2 (Architecture & Dependencies):** Traced full pipeline: `PositionPreservedAxiom` → `PositionValidationDataBuilder` → `PositionValidationPipeline` → `ContextMatcher.find_best_match()` → `ViolationFilter.filter()`. Identified affected layers: verification/axioms/position strategies only. Found existing test patterns with `Mock` pipeline and `VerificationContext` fixtures.

**Key codebase findings:**
- `ContextMatcher.find_best_match()` uses `min_match_ratio=0.85` (Phase 2) with two existing fallbacks
- Short context (≤2 words on each side) makes `SequenceMatcher` ratio unreliable — no fallback covers this case
- The command currently PASSES (the stale-path issue was fixed separately); the plan addresses the axiom matching failure

**Three root causes analyzed:**
1. Context mismatch from over-expansion of `known_changed` words in `ContextExpander`
2. V2 candidate line number misalignment (entries excluded from `entries_by_line`)
3. Short context at document edges making `SequenceMatcher` ratio below 0.85 threshold

## Phase 3: Design & Decisions

Three approaches were analyzed:

- **Approach 1 (Selected):** Diagnose via debug dump + add `_try_short_context_fallback` to `ContextMatcher`. Follows existing `_try_*` fallback pattern. LOW complexity, LOW risk, targeted (only activates for ≤2-word context with full word overlap).
- **Approach 2 (Not Selected):** Reduce global `min_match_ratio` from 0.85 to lower value. Too blunt — creates false negatives for all documents.
- **Approach 3 (Not Selected):** Fix adjacent merger gap threshold. Speculative without debug evidence — could be Approach 1 secondary fix if debug dump confirms over-merging.

Clear path forward — no user questions required (SKILL.md allows skipping questions when one approach is obviously best).

## Phase 4: Plan Written

**4 implementation tasks, all ending with `/test-driven-development` reference:**

| Task | Description | /test-driven-development |
|------|-------------|--------------------------|
| Task 1 | Add failing scenario test reproducing addition_position_preserved violation | YES |
| Task 2 | Add `_try_short_context_fallback` to `ContextMatcher` | YES |
| Task 3 | Verify debug dump output to confirm root cause | YES |
| Task 4 | Add regression integration test for nype46 end-to-end verify | YES |

**Files to modify: 2**
- `src/data_migrator/services/verification/axioms/position/strategies/context_matcher.py`
- `tests/unit/services/verification/axioms/position/test_axiom.py`

**Files to create: 2**
- `tests/unit/services/verification/axioms/position/strategies/test_context_matcher.py`
- `tests/integration/test_addition_position_preserved_nype46.py`

## Verification: Regression Block Present

**YES** — The Verification section contains a dedicated Regression block with the verbatim CLI command from the task input:

```
### Regression
Delegate to `test-runner` subagent:
Run: uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
Expected: exits 0 with "[PASS] addition_position_preserved" in output and no validation errors
```

## Compliance Check

| SKILL.md requirement | Status |
|----------------------|--------|
| Slug chosen (3-5 descriptive words, kebab-case) | PASS — `fix-addition-position-preserved-validation` |
| 2 explorer agents for Medium scope | PASS |
| 2+ approaches with pros/cons | PASS — 3 approaches |
| Each task ends with `/test-driven-development` | PASS — all 4 tasks |
| Failing CLI command in Regression block | PASS — verbatim command |
| Exact file paths in every task | PASS |
| Concrete ✅/❌ test cases per task | PASS |
| No implementation performed | PASS |
