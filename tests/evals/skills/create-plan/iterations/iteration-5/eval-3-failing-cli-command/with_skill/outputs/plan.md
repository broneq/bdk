# Plan: Fix addition_position_preserved Axiom Failure for Placeholders in IGNORE Context

**Created:** 2026-03-27
**Status:** Ready for implementation
**Goal:** Fix a false violation in the `addition_position_preserved` axiom caused by `dfplaceholder` elements inside IGNORE-type contexts emitting spurious ADDITION tokens that have no matching position in V2.
**Architecture:** Narrow bug fix in `SeaDomWalker._extract_placeholder` — change method signature to return `list[SourceToken]`, add IGNORE guard, and update caller in `_handle_tag`. No changes needed to the axiom or pipeline.
**Complexity:** LOW

---

## Context

When a SEA Contracts document contains a `dfplaceholder` element nested inside a deletion context that was promoted to IGNORE (nested change-type contradiction), the DOM walker must suppress that placeholder entirely. Before commit `cb77627`, the method returned `text_type=inherited_type or ChangeType.BLACK`, which silently avoided the ADDITION path. After the refactor in `cb77627`, the method was changed to always emit `text_type=ChangeType.ADDITION` (correct for non-IGNORE cases), but the IGNORE suppression was not added.

As a result:
1. `V1Extractor.build_word_sequence()` counts the placeholder's value as an ADDITION token.
2. The migration itself suppresses the placeholder (because IGNORE means "skip"), so V2 XML does not contain the placeholder as an addition.
3. `PositionPreservedAxiom` (`addition_position_preserved`) finds the V1 addition has no matching V2 position and raises a violation — even though migration was correct.

The fix is straightforward: `_extract_placeholder` must return `list[SourceToken]` (consistent with all other DOM walker methods) and return `[]` when `inherited_type == ChangeType.IGNORE`, mirroring the already-correct `_handle_text` method which has the same guard.

The failing CLI command that demonstrates the issue:
```
uv run data-migrator migrate --name=nype46 tests/fixtures/orv1/nype46/document_test_4201_anon.html --debug-dir=tmp/dumps --verify
```
This command exits non-zero with `[FAIL] addition_position_preserved`.

---

## Explored Approaches

### Approach 1: Fix _extract_placeholder to return list + add IGNORE guard (Selected)

**Description:** Change `_extract_placeholder` to return `list[SourceToken]` and add an early return for `inherited_type == ChangeType.IGNORE`. Update `_handle_tag` to call it without wrapping in a list. This mirrors the existing IGNORE guard in `_handle_text` and makes all DOM walker methods return consistent types.

**Design pattern:** Template Method / Guard Clause

**OO principles:** SRP (fix at source of emission), OCP (no changes to axiom or pipeline), DIP (no new dependencies introduced)

**Pros:**
- Minimal, localized change — only 2 methods in one file affected
- Consistent with `_handle_text` which also returns `list[SourceToken]` and guards on IGNORE
- The untracked test file already exists and covers all cases

**Cons:**
- Requires updating the method return type (though `_extract_placeholder` is a private method — no callers outside the class)

**Complexity:** LOW
**Risk:** LOW
**Files to change:**
- Modify: `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py`
- Create: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py` (untracked file already exists in working tree)

---

### Approach 2: Filter IGNORE placeholders in V1Extractor (Not Selected)

**Description:** Keep `_extract_placeholder` returning a single `SourceToken` with `text_type=ChangeType.ADDITION`, but modify `V1Extractor._collect_segments` to skip segments whose change_type is IGNORE.

**Pros / Cons:** Would suppress the violation symptom, but adds a special-case filter deep in the extractor that is unrelated to extractor responsibilities. The extractor deals with segment collection, not change-context suppression. Harder to test in isolation.

**Why not selected:** Root cause is in `SeaDomWalker` — the walker should not emit tokens for IGNORE contexts. Fixing symptoms in the extractor violates SRP and would leave the dom_walker in an inconsistent state (all methods return `list[SourceToken]` except `_extract_placeholder`).

---

### Approach 3: Fix PositionPreservedAxiom to skip IGNORE-sourced additions (Not Selected)

**Description:** Detect IGNORE-origin tokens in the axiom data builder and exclude them from the `v1_changes` map before running the pipeline.

**Pros / Cons:** Technically resolves the false violation, but the axiom does not have access to the original `ChangeType` context at validation time. This would require threading additional metadata through `SourceToken` or `WordContext` — a high-complexity, high-risk change for a simple source-level bug.

**Why not selected:** Over-engineering. The fix belongs at the emission layer, not the validation layer.

---

## Selected Approach: Fix _extract_placeholder to return list + add IGNORE guard

**Rationale:** The bug is in `SeaDomWalker._extract_placeholder`: it emits a token even when the inherited type is IGNORE. Every other DOM walker method already returns `list[SourceToken]` and guards on IGNORE. Making `_extract_placeholder` consistent with this convention is the minimal, correct, and principled fix. Complexity is LOW, risk is LOW, and the untracked test file already provides full coverage.

---

## Implementation Tasks

### Task 1: Fix SeaDomWalker._extract_placeholder to suppress IGNORE placeholders

**Files:**
- Modify: `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py`
- Test: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py` (untracked file already exists in working tree)

**Test cases:**
- ✅ Positive: given `_extract_placeholder(element, inherited_type=None)`, returns list of 1 `SourceToken` with `type=PLACEHOLDER` and `text_type=ADDITION`
- ✅ Positive: given `_extract_placeholder(element, inherited_type=ChangeType.ADDITION)`, returns list of 1 token with `text_type=ADDITION`
- ✅ Positive: given `_extract_placeholder(element, inherited_type=ChangeType.DELETION)`, returns list of 1 token with `text_type=ADDITION` (placeholder in deletion context still emits ADDITION — domain model rule)
- ✅ Positive: given `_extract_placeholder(element, inherited_type=ChangeType.BLACK)`, returns list of 1 token with `text_type=ADDITION`
- ❌ Negative: given `_extract_placeholder(element, inherited_type=ChangeType.IGNORE)`, returns `[]` (empty list — placeholder suppressed)

**Test scaffold:**
```python
# Setup: no fixture needed — instantiate SeaDomWalker directly with SeaChangeTypeDetector
from bs4 import BeautifulSoup
import pytest
from data_migrator.processors.tokenizers.sea.core.change_type_detector import SeaChangeTypeDetector
from data_migrator.processors.tokenizers.sea.core.dom_walker import SeaDomWalker
from data_migrator.schemas.models.token import ChangeType, TokenType

def make_placeholder_element(system_name="VESSEL_NAME", title="Vessel Name", text="TBN"):
    html = f'<dfplaceholder dfsystemname="{system_name}" title="{title}">{text}</dfplaceholder>'
    return BeautifulSoup(html, "lxml-xml").find("dfplaceholder")

@pytest.fixture
def walker():
    return SeaDomWalker(SeaChangeTypeDetector())

def test_inherited_type_ignore_returns_empty_list(walker):
    # arrange
    element = make_placeholder_element()
    # act
    result = walker._extract_placeholder(element, inherited_type=ChangeType.IGNORE)
    # assert
    assert result == []

def test_inherited_type_none_emits_addition_token(walker):
    # arrange
    element = make_placeholder_element()
    # act
    result = walker._extract_placeholder(element, inherited_type=None)
    # assert
    assert len(result) == 1
    assert result[0].type == TokenType.PLACEHOLDER
    assert result[0].text_type == ChangeType.ADDITION

def test_inherited_type_deletion_emits_addition_token(walker):
    # arrange
    element = make_placeholder_element()
    # act
    result = walker._extract_placeholder(element, inherited_type=ChangeType.DELETION)
    # assert
    assert len(result) == 1
    assert result[0].text_type == ChangeType.ADDITION

def test_inherited_type_addition_emits_addition_token(walker):
    element = make_placeholder_element()
    result = walker._extract_placeholder(element, inherited_type=ChangeType.ADDITION)
    assert len(result) == 1
    assert result[0].text_type == ChangeType.ADDITION

def test_inherited_type_black_emits_addition_token(walker):
    element = make_placeholder_element()
    result = walker._extract_placeholder(element, inherited_type=ChangeType.BLACK)
    assert len(result) == 1
    assert result[0].text_type == ChangeType.ADDITION
```

**Implementation:**

Change `_extract_placeholder` signature from `-> SourceToken` to `-> list[SourceToken]`, add IGNORE guard, and return the token wrapped in a list. Update `_handle_tag` to call without wrapping:

```python
def _handle_tag(self, element: Tag, inherited_type: ChangeType | None) -> list[SourceToken]:
    if element.name == "dfplaceholder":
        return self._extract_placeholder(element, inherited_type)  # no list() wrap
    if element.name == "p":
        return self._handle_paragraph(element, inherited_type)
    if element.name == "br":
        return []
    current_type = self._change_detector.detect(element, inherited_type)
    return self.walk(element, current_type)

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

### Task 2: Verify walk() integration — placeholder inside IGNORE-inherited context emits no tokens

**Files:**
- Test: `tests/unit/processors/tokenizers/sea/core/test_dom_walker.py`
- No source changes needed (covered by Task 1's fix)

**Test cases:**
- ✅ Positive: `walker.walk(div_with_placeholder, None)` returns 1 PLACEHOLDER token (baseline not broken)
- ✅ Positive: `walker.walk(span_with_placeholder, ChangeType.IGNORE)` returns `[]` — placeholder suppressed when walk() receives IGNORE
- ✅ Positive: `walker.walk(span_with_text, ChangeType.IGNORE)` returns `[]` — text also suppressed (pre-existing behavior)

**Test scaffold:**
```python
# Setup: walker fixture from Task 1

def parse_element(html: str):
    from bs4 import BeautifulSoup
    return BeautifulSoup(html, "html.parser").find()

def test_walk_placeholder_standalone_emits_token(walker):
    # arrange: plain dfplaceholder not under IGNORE
    element = parse_element('<div><dfplaceholder dfsystemname="X" title="Y">TBN</dfplaceholder></div>')
    # act
    tokens = walker.walk(element, None)
    # assert
    assert len(tokens) == 1
    assert tokens[0].type == TokenType.PLACEHOLDER

def test_walk_placeholder_with_ignore_inherited_returns_empty(walker):
    # arrange: pass IGNORE as inherited_type to walk()
    element = parse_element('<span><dfplaceholder dfsystemname="X" title="Y">TBN</dfplaceholder></span>')
    # act
    tokens = walker.walk(element, ChangeType.IGNORE)
    # assert
    assert tokens == []

def test_walk_text_with_ignore_returns_empty(walker):
    element = parse_element("<span>content</span>")
    tokens = walker.walk(element, ChangeType.IGNORE)
    assert tokens == []
```

**Implementation:** No additional source code changes — this task only adds integration-level tests that exercise the existing call chain after Task 1's fix.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

### Task 3: Regression — nype46 migration with --verify passes

**Files:**
- No code changes; acceptance criterion for the full fix

**Test cases:**
- ✅ Positive: CLI command exits 0 with `[PASS] addition_position_preserved` in output
- ✅ Positive: No other axiom violations introduced (no regressions)

**Test scaffold:**
```python
# CLI regression — see Verification section
```

**Implementation:** No code changes. After Tasks 1 and 2 complete, run the CLI regression command to confirm end-to-end correctness.

> Follow `/test-driven-development` skill for test writing and red-green-clean cycle.

---

## Reusable Components

**Existing utilities to leverage:**
- `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py:SeaDomWalker._handle_text` — identical IGNORE guard pattern: `if change_type == ChangeType.IGNORE: return []`
- `src/data_migrator/services/verification/axioms/position/axiom.py:PositionPreservedAxiom` — axiom being fixed; no changes needed

**Relevant schemas/models:**
- `src/data_migrator/schemas/models/token.py` — `ChangeType.IGNORE`, `TokenType.PLACEHOLDER`, `SourceToken`, `SourceTokenMetadata`, `PlaceholderInfo`

**Patterns to follow:**
- All DOM walker methods return `list[SourceToken]` — `_extract_placeholder` must be consistent
- IGNORE guard pattern from `_handle_text`: `if change_type == ChangeType.IGNORE: return []`

**Test helpers to use:**
- `make_placeholder_element()` helper (defined in test file, creates a `dfplaceholder` BeautifulSoup element)
- `parse_element()` helper (defined in test file, parses HTML fragment to root element)

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
- Placeholder with `inherited_type=DELETION` still emits ADDITION token (DELETION+PLACEHOLDER contradiction resolved by domain model: always emit ADDITION)
- Placeholder with `inherited_type=IGNORE` emits NO token (the fix)
- `walk()` called with `inherited_type=ChangeType.IGNORE` on element containing `dfplaceholder` returns empty list

---

## Success Criteria

**Must have:**
- `_extract_placeholder` returns `list[SourceToken]` (not single token)
- IGNORE guard: `if inherited_type == ChangeType.IGNORE: return []` at top of `_extract_placeholder`
- `_handle_tag` calls `return self._extract_placeholder(...)` directly (no extra `list()` wrap)
- All 5 test cases in `TestExtractPlaceholderInheritedType` pass
- All 3 test cases in `TestWalk` (walk integration tests) pass
- CLI command exits 0 with `[PASS] addition_position_preserved`
- mypy, ruff, radon all pass

**Nice to have:**
- Integration test covering a full SEA document where a placeholder appears nested inside a deletion-inside-addition contradiction context

---

## References

**Code Standards:**
@.claude/shared/code-quality.md

**Design Doc:** none

**Memories Referenced:**
- `sea_contracts_format` — SEA Contracts HTML format, CKEditor+ICE dual-layer change tracking, dfplaceholder elements, IGNORE promotion of nested contradictions
- `code_style_and_conventions` — return type consistency, private method conventions

**Similar Implementations:**
- `src/data_migrator/processors/tokenizers/sea/core/dom_walker.py:SeaDomWalker._handle_text` — identical IGNORE guard pattern: `if change_type == ChangeType.IGNORE: return []`
