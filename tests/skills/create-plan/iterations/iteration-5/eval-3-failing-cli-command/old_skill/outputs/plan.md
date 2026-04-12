# Plan: Fix addition_position_preserved Axiom Failure for Placeholders in IGNORE Context

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Fix a false violation in the `addition_position_preserved` axiom caused by `dfplaceholder` elements inside IGNORE-type contexts emitting spurious ADDITION tokens that have no matching position in V2.
**Architecture:** Narrow bug fix in `SeaDomWalker._extract_placeholder` — change method signature to return `list[SourceToken]`, add IGNORE guard, and update caller in `_handle_tag`. No changes needed to the axiom or pipeline.
**Complexity:** LOW

---

## Context

When a SEA Contracts document contains a `dfplaceholder` element nested inside a deletion context that was promoted to IGNORE (nested change-type contradiction), the DOM walker should suppress that placeholder entirely. Before commit `cb77627`, the method returned `text_type=inherited_type or ChangeType.BLACK`, which silently avoided the ADDITION path. After the refactor in `cb77627`, the method was changed to always emit `text_type=ChangeType.ADDITION` (correct for non-IGNORE cases), but the IGNORE suppression was not added.

As a result:
1. `V1Extractor.build_word_sequence()` counts the placeholder's value as an ADDITION.
2. The migration itself suppresses the placeholder (because IGNORE means "skip"), so V2 XML does not contain the placeholder as an addition.
3. `PositionPreservedAxiom` (`addition_position_preserved`) finds the V1 addition has no matching V2 position and raises a violation — even though migration was correct.

The fix is already present as unstaged changes in the working tree:
- `_extract_placeholder` returns `list[SourceToken]` (instead of `SourceToken`)
- Adds `if inherited_type == ChangeType.IGNORE: return []` guard
- `_handle_tag` calls `return self._extract_placeholder(...)` directly (no extra list wrap)

The untracked test file `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py` covers the new API and includes the IGNORE case.

---

## Explored Approaches

### Approach 1: Fix _extract_placeholder to return list + add IGNORE guard (Selected)

**Description:** Change `_extract_placeholder` to return `list[SourceToken]` and add an early return for `inherited_type == ChangeType.IGNORE`. Update `_handle_tag` to call it directly without wrapping in a list. This is already present as unstaged working tree changes.

**Pros:**
- Minimal, localized change — only 2 methods in one file affected
- Consistent with `_handle_text` which also returns empty list for IGNORE
- The test already exists in the working tree (untracked)

**Cons:**
- Requires updating the method signature which is a breaking API change (though `_extract_placeholder` is a private method)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Modify: `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py`
- Create: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py` (file already exists in working tree as untracked)

---

### Approach 2: Filter IGNORE placeholders in V1Extractor (Not Selected)

**Description:** Keep `_extract_placeholder` returning a single `SourceToken` with `text_type=ChangeType.ADDITION`, but modify `V1Extractor._collect_segments` to skip segments whose `change_type` is IGNORE.

**Pros / Cons:** Would work but adds a special-case filter deep in the extractor that is unrelated to extractor responsibilities. The root cause is in the walker; filtering symptoms in the extractor violates SRP. Also harder to test.

**Why not selected:** Root cause is in `SeaDomWalker` — the walker should not emit tokens for IGNORE contexts. Fixing it at the source is cleaner and more principled.

---

## Selected Approach: Fix _extract_placeholder to return list + add IGNORE guard

**Rationale:** The bug is in `SeaDomWalker._extract_placeholder`: it emits a token even when the inherited type is IGNORE. Fixing it at the source with a minimal signature change is the cleanest solution. The unstaged working tree already contains the correct fix; this plan formalizes the TDD cycle.

---

## Implementation Tasks

### Task 1: Fix SeaDomWalker._extract_placeholder to suppress IGNORE placeholders

**Files:**
- Modify: `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py`
- Test: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py` (untracked file already exists)

**Test cases:**
- ✅ Positive: given `_extract_placeholder(element, inherited_type=None)`, returns list of 1 `SourceToken` with `type=PLACEHOLDER` and `text_type=ADDITION`
- ✅ Positive: given `_extract_placeholder(element, inherited_type=ChangeType.ADDITION)`, returns list of 1 token with `text_type=ADDITION`
- ✅ Positive: given `_extract_placeholder(element, inherited_type=ChangeType.DELETION)`, returns list of 1 token with `text_type=ADDITION` (placeholder in deletion is still ADDITION)
- ✅ Positive: given `_extract_placeholder(element, inherited_type=ChangeType.BLACK)`, returns list of 1 token with `text_type=ADDITION`
- ❌ Negative: given `_extract_placeholder(element, inherited_type=ChangeType.IGNORE)`, returns `[]` (empty list — placeholder suppressed)

**Test scaffold:**
```python
# Setup: no fixture needed — instantiate SeaDomWalker directly with SeaChangeTypeDetector
def make_placeholder_element(system_name="VESSEL_NAME", title="Vessel Name", text="TBN"):
    html = f'<dfplaceholder dfsystemname="{system_name}" title="{title}">{text}</dfplaceholder>'
    return BeautifulSoup(html, "lxml-xml").find("dfplaceholder")

@pytest.fixture
def walker():
    return SeaDomWalker(SeaChangeTypeDetector())

def test_inherited_type_ignore_returns_empty_list(walker):
    element = make_placeholder_element()
    result = walker._extract_placeholder(element, inherited_type=ChangeType.IGNORE)
    assert result == []

def test_inherited_type_none_emits_addition_token(walker):
    element = make_placeholder_element()
    result = walker._extract_placeholder(element, inherited_type=None)
    assert len(result) == 1
    assert result[0].type == TokenType.PLACEHOLDER
    assert result[0].text_type == ChangeType.ADDITION
```

**Implementation:**

Change `_extract_placeholder` signature from `-> SourceToken` to `-> list[SourceToken]`, add IGNORE guard, and return the token wrapped in a list. Update `_handle_tag` to call without wrapping:

```python
def _handle_tag(self, element: Tag, inherited_type: ChangeType | None) -> list[SourceToken]:
    if element.name == "dfplaceholder":
        return self._extract_placeholder(element, inherited_type)  # no list() wrap
    ...

def _extract_placeholder(self, element: Tag, inherited_type: ChangeType | None) -> list[SourceToken]:
    if inherited_type == ChangeType.IGNORE:
        return []
    system_name = str(element.get("dfsystemname", ""))
    title = str(element.get("title", ""))
    if not system_name:
        logger.warning("dfplaceholder_missing_dfsystemname", element=str(element)[:100])
    value = element.get_text(strip=True).replace("\xa0", "")
    return [SourceToken(
        type=TokenType.PLACEHOLDER,
        value=value,
        text_type=ChangeType.ADDITION,
        metadata=SourceTokenMetadata(
            placeholder=PlaceholderInfo(id=system_name, name=title, is_smart=False)
        ),
    )]
```

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 2: Verify _handle_tag delegates to updated _extract_placeholder correctly

**Files:**
- Modify: `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py` (same file — verify walk() integration)
- Test: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py`

**Test cases:**
- ✅ Positive: `walker.walk(div_with_placeholder, None)` returns 1 PLACEHOLDER token
- ✅ Positive: `walker.walk(div_with_placeholder_in_ignore_span, None)` returns `[]` — no token emitted when placeholder inherits IGNORE
- ✅ Positive: `walker.walk(span_with_text, ChangeType.IGNORE)` returns `[]` — text also suppressed

**Test scaffold:**
```python
# Setup: no fixture; use parse_element() helper
def test_walk_placeholder_with_ignore_inherited_returns_empty(walker):
    # Simulate: <span data-cke-bookmark="1"><dfplaceholder .../></span>
    # where SeaChangeTypeDetector returns IGNORE for the span
    element = parse_element(
        '<span><dfplaceholder dfsystemname="X" title="Y">TBN</dfplaceholder></span>'
    )
    # Inject IGNORE inherited type
    tokens = walker.walk(element, ChangeType.IGNORE)
    assert tokens == []
```

**Implementation:** No additional code changes — this test exercises the already-fixed `_handle_tag` / `_extract_placeholder` call chain. Verifies integration.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Regression test — nype46 migration with --verify passes

**Files:**
- Test: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py` (no new file needed)

**Test cases:**
- ✅ Positive: The nype46 migration CLI command exits 0 with `[PASS] addition_position_preserved`
- ✅ Positive: All other axioms also pass (no regressions introduced by the fix)

**Test scaffold:**
```python
# This task is validated via CLI regression (see Verification section below)
# No unit test needed here — the regression is captured by the CLI check
```

**Implementation:** No code changes — this task is the acceptance criterion: after Tasks 1 and 2 are complete, the CLI command must pass cleanly.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py:SeaDomWalker._handle_text` - pattern for IGNORE guard: `if change_type == ChangeType.IGNORE: return []`
- `src/data_migrator/services/verification/axioms/position/axiom.py:PositionPreservedAxiom` - axiom under test

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/token.py` - `ChangeType.IGNORE`, `TokenType.PLACEHOLDER`, `SourceToken`

**Patterns to follow:**
- `_handle_text` uses the same IGNORE guard pattern — `_extract_placeholder` should follow it
- All DOM walker methods return `list[SourceToken]` — `_extract_placeholder` should be consistent

**Test helpers to use:**
- `make_placeholder_element()` helper in existing test file (already defined in the untracked test file)
- `parse_element()` helper for integration-style walk tests

---

## Verification

### Tests

Delegate to `test-runner` subagent:
```
Run: pytest tests/unit/processors/tokenizers/sea/core/test_dom_walker.py -v --cov=src/data_migrator/processors/tokenizers/sea/core/dom_walker
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

### Regression

Delegate to `test-runner` subagent:
```
Run: uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
Expected: exits 0 with no validation errors, [PASS] addition_position_preserved displayed
```

### Edge Cases to Test

- Placeholder with `inherited_type=None` still emits ADDITION token (baseline behavior not broken)
- Placeholder with `inherited_type=DELETION` still emits ADDITION token (DELETION contradicts PLACEHOLDER, but ADDITION is correct per domain model)
- Placeholder with `inherited_type=IGNORE` emits NO token (the fix)
- `walk()` with entire subtree under IGNORE still returns empty list for placeholders

---

## Success Criteria

**Must have:**
- `_extract_placeholder` returns `list[SourceToken]` (not single token)
- IGNORE guard: `if inherited_type == ChangeType.IGNORE: return []`
- `_handle_tag` calls `return self._extract_placeholder(...)` directly (no extra list wrap)
- All test cases in `test_dom_walker.py` pass
- CLI command exits 0 with `[PASS] addition_position_preserved`
- Static analysis passes (mypy + ruff + radon)

**Nice to have:**
- Integration test covering a SEA document where a placeholder appears in a deletion-inside-addition context

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** none

**Memories Referenced:**
- `sea_contracts_format` — SEA Contracts HTML format, CKEditor+ICE dual-layer change tracking, dfplaceholder elements
- `code_style_and_conventions` — return type consistency, private method conventions

**Similar Implementations:**
- `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py:SeaDomWalker._handle_text` — identical IGNORE guard pattern: `if change_type == ChangeType.IGNORE: return []`
