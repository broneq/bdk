# Transcript Summary: create-plan eval-3-failing-cli-command

## Phases Ran

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Parse & Setup | COMPLETE | Slug `fix-addition-position-preserved-axiom`. Plan file `2026-03-27-fix-addition-position-preserved-axiom.md` already existed — created v2 at `2026-03-27-fix-addition-position-preserved-axiom-v2.md` |
| Phase 2: Exploration | COMPLETE | 2 agents dispatched (Medium scope) |
| Phase 3: Design & Decisions | COMPLETE | 3 approaches analyzed; clear winner — no user question needed |
| Phase 4: Write Plan | COMPLETE | Full plan written with 3 tasks |
| Phase 5: Summary & Handoff | COMPLETE | |

---

## Explorer Agents Dispatched

**Scope determination:** Medium (cross-file: dom_walker + test file + verification axiom pipeline)

**Agent 1 — Utilities & Existing Implementations**
- Tool: `mcp__serena__search_for_pattern` for `_extract_placeholder`, `_handle_tag`, `_handle_text`
- Tool: Direct file read of `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py`
- Tool: `mcp__serena__search_for_pattern` for `addition_position_preserved`, `PositionPreservedAxiom`
- Findings: `_handle_text` contains identical IGNORE guard pattern; `_extract_placeholder` was missing it; untracked test file already exists with full coverage

**Agent 2 — Architecture & Dependencies**
- Tool: `mcp__serena__get_symbols_overview` for `PositionPreservedAxiom`
- Tool: `mcp__serena__find_symbol` for `PositionPreservedAxiom/validate` body
- Tool: `mcp__serena__search_for_pattern` for `V1Extractor`, `build_word_sequence`, `_collect_segments`
- Findings: Axiom uses `PositionValidationDataBuilder` which calls `v1_extractor.build_word_sequence()` — that method counts PLACEHOLDER tokens as additions; confirmed no changes needed to axiom or extractor

---

## Approach Selected

**Selected:** "Fix _extract_placeholder to return list + add IGNORE guard"

**Rationale:** Minimal, localized fix at the root cause. `_extract_placeholder` was the only DOM walker method returning a single `SourceToken` instead of `list[SourceToken]`, and the only one missing the IGNORE guard. Two alternative approaches (filter in V1Extractor; filter in PositionPreservedAxiom) were rejected for SRP violations and over-engineering respectively.

**3 approaches documented:**
1. Fix `_extract_placeholder` return type + IGNORE guard (SELECTED) — LOW complexity, LOW risk
2. Filter IGNORE placeholders in V1Extractor (NOT SELECTED) — SRP violation, wrong layer
3. Fix axiom to skip IGNORE-sourced additions (NOT SELECTED) — over-engineering, requires threading metadata

---

## Tasks Created

| Task | Description | Files |
|------|-------------|-------|
| Task 1 | Fix `SeaDomWalker._extract_placeholder` to suppress IGNORE placeholders | Modify `dom_walker.py`, create `test_dom_walker.py` |
| Task 2 | Verify `walk()` integration — placeholder in IGNORE context | Test only (`test_dom_walker.py`) |
| Task 3 | Regression: nype46 migration with --verify passes | CLI regression (no code changes) |

---

## Test Scaffold Quality Check

| Task | Has scaffold? | Stubs per test case |
|------|--------------|---------------------|
| Task 1 | YES | 5 stubs for 5 test cases (1 negative IGNORE + 4 positive types) |
| Task 2 | YES | 3 stubs for 3 test cases (walk() integration) |
| Task 3 | YES (exception) | `# CLI regression — see Verification section` (correct exception per skill rules) |

All non-CLI tasks have one `def test_...` stub per `✅/❌` bullet with concrete arrange/act/assert skeleton. Task 3 correctly uses the CLI regression exception note instead of stubs.

---

## Verification Section

- **Tests:** `pytest tests/unit/processors/tokenizers/sea/core/test_dom_walker.py -v --cov=...`
- **Code Quality:** `bin/cleanup.sh`
- **Regression:** `uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify` (extracted verbatim from failing CLI command in task input)

---

## Plan File

`docs/plans/2026-03-27-fix-addition-position-preserved-axiom-v2.md`
