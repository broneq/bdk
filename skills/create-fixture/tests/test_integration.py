#!/usr/bin/env python3
"""Integration tests for FixtureBuilder — full round-trip through save() and validate_fixture.py.

Each test:
  1. Creates a real fixture file from a real template
  2. Verifies save() exits without raising (validator passes)
  3. Cleans up the generated file

Run:
    python3 .claude/skills/create-fixture/tests/test_integration.py
"""

from __future__ import annotations

import sys
import tempfile
from pathlib import Path

# Resolve project root (4 levels up from this file)
_THIS = Path(__file__).resolve()
_PROJECT_ROOT = _THIS.parents[4]
sys.path.insert(0, str(_PROJECT_ROOT / ".claude/skills/create-fixture/scripts"))

from fixture_builder import FixtureBuilder  # noqa: E402

_SEA_TEMPLATE = _PROJECT_ROOT / "tests/fixtures/sea/nype46/template.html"
_FROALA_TEMPLATE = _PROJECT_ROOT / "tests/fixtures/orv1/nype46/template.html"


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


# ---------------------------------------------------------------------------
# SEA format
# ---------------------------------------------------------------------------


def test_sea_delete_produces_valid_fixture() -> None:
    """delete() on SEA template passes validator via save()."""
    b = FixtureBuilder.from_template(str(_SEA_TEMPLATE))
    b.delete("Steamship/Motorship")

    with tempfile.NamedTemporaryFile(
        dir=_SEA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)  # raises ValueError if validator fails
        _assert(output.exists(), f"save() did not create file: {output}")
        content = output.read_text(encoding="utf-8")
        _assert("ice-del" in content, "SEA deletion missing ice-del class")
        _assert("Steamship/Motorship" in content, "Deleted text should remain wrapped in <del>")
    finally:
        output.unlink(missing_ok=True)


def test_sea_replace_produces_valid_fixture() -> None:
    """replace() on SEA template passes validator via save()."""
    b = FixtureBuilder.from_template(str(_SEA_TEMPLATE))
    b.replace("Steamship/Motorship", "MV OSLO TRADER")

    with tempfile.NamedTemporaryFile(
        dir=_SEA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("ice-del" in content, "replace() should produce a deletion")
        _assert("ice-ins" in content, "replace() should produce an insertion")
        _assert("MV OSLO TRADER" in content, "Inserted text not found in output")
    finally:
        output.unlink(missing_ok=True)


def test_sea_insert_after_produces_valid_fixture() -> None:
    """insert_after() on SEA template passes validator via save()."""
    b = FixtureBuilder.from_template(str(_SEA_TEMPLATE))
    b.insert_after("Steamship/Motorship", " MV CAPE STAR II")

    with tempfile.NamedTemporaryFile(
        dir=_SEA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("ice-ins" in content, "insert_after() should produce an insertion")
        _assert("MV CAPE STAR II" in content, "Inserted text not found in output")
    finally:
        output.unlink(missing_ok=True)


def test_sea_fill_placeholder_produces_valid_fixture() -> None:
    """fill_placeholder() on SEA template passes validator via save().

    SEA fill_placeholder inserts the value inside a <dfplaceholder> tag — it does
    not produce an <ins> element. The validator requires at least one tracked change
    (ice-ins or ice-del), so we add a deletion alongside the placeholder fill.
    """
    b = FixtureBuilder.from_template(str(_SEA_TEMPLATE))
    b.fill_placeholder("cke_36_df_0", "MV BALTIC HORIZON")
    b.delete("Steamship/Motorship")  # required: validator needs at least one tracked change

    with tempfile.NamedTemporaryFile(
        dir=_SEA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("MV BALTIC HORIZON" in content, "Placeholder value not found in output")
        _assert("ice-del" in content, "Deletion tracking not found in output")
    finally:
        output.unlink(missing_ok=True)


def test_sea_combined_operations_produce_valid_fixture() -> None:
    """Multiple operations together produce a valid SEA fixture."""
    b = FixtureBuilder.from_template(str(_SEA_TEMPLATE))
    b.fill_placeholder("cke_36_df_0", "MV RIO GRANDE")
    b.delete("Steamship/Motorship")
    b.insert_after("Steamship/Motorship", " MV RIO GRANDE")

    with tempfile.NamedTemporaryFile(
        dir=_SEA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("ice-del" in content, "deletion missing")
        _assert("ice-ins" in content, "insertion missing")
        _assert("MV RIO GRANDE" in content, "vessel name missing")
    finally:
        output.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Froala format
# ---------------------------------------------------------------------------


def test_froala_delete_produces_valid_fixture() -> None:
    """delete() on Froala template passes validator via save()."""
    b = FixtureBuilder.from_template(str(_FROALA_TEMPLATE))
    b.delete("Owners")

    with tempfile.NamedTemporaryFile(
        dir=_FROALA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert(
            "fr-tracking-deleted" in content, "Froala deletion missing fr-tracking-deleted class"
        )
        _assert(
            'data-change-type="deletion"' in content, "Froala deletion missing data-change-type"
        )
    finally:
        output.unlink(missing_ok=True)


def test_froala_replace_produces_valid_fixture() -> None:
    """replace() on Froala template passes validator via save()."""
    b = FixtureBuilder.from_template(str(_FROALA_TEMPLATE))
    b.replace("Owners", "Baltic Shipping GmbH")

    with tempfile.NamedTemporaryFile(
        dir=_FROALA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("fr-tracking-deleted" in content, "replace() should produce a deletion")
        _assert("fr-highlight-change" in content, "replace() should produce an insertion")
        _assert("Baltic Shipping GmbH" in content, "Inserted text not found in output")
    finally:
        output.unlink(missing_ok=True)


def test_froala_fill_placeholder_produces_valid_fixture() -> None:
    """fill_placeholder() on Froala template passes validator via save()."""
    b = FixtureBuilder.from_template(str(_FROALA_TEMPLATE))
    b.fill_placeholder("charter-party-place", "Hamburg")

    with tempfile.NamedTemporaryFile(
        dir=_FROALA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("Hamburg" in content, "Placeholder value not found in output")
        _assert("fr-highlight-change" in content, "fill_placeholder() should add an addition span")
    finally:
        output.unlink(missing_ok=True)


def test_froala_combined_operations_produce_valid_fixture() -> None:
    """Multiple operations together produce a valid Froala fixture."""
    b = FixtureBuilder.from_template(str(_FROALA_TEMPLATE))
    b.fill_placeholder("charter-party-place", "Rotterdam")
    b.delete("Owners")
    b.insert_after("Charterers", " Koch Supply & Trading LP")

    with tempfile.NamedTemporaryFile(
        dir=_FROALA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        b.save(output.name)
        content = output.read_text(encoding="utf-8")
        _assert("fr-tracking-deleted" in content, "deletion missing")
        _assert("fr-highlight-change" in content, "insertion missing")
        _assert("Rotterdam" in content, "placeholder value missing")
        _assert("Koch Supply" in content, "inserted text missing")
    finally:
        output.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Error path: no changes → save() must raise
# ---------------------------------------------------------------------------


def test_save_raises_when_no_changes_applied() -> None:
    """save() raises ValueError when no changes were applied."""
    b = FixtureBuilder.from_template(str(_SEA_TEMPLATE))

    with tempfile.NamedTemporaryFile(
        dir=_SEA_TEMPLATE.parent,
        prefix="test_integ_",
        suffix=".html",
        delete=False,
    ) as f:
        output = Path(f.name)

    try:
        raised = False
        try:
            b.save(output.name)
        except ValueError as e:
            raised = True
            _assert("no changes applied" in str(e).lower(), f"Unexpected error message: {e}")
        _assert(raised, "save() should raise ValueError when no changes were applied")
    finally:
        output.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        test_sea_delete_produces_valid_fixture,
        test_sea_replace_produces_valid_fixture,
        test_sea_insert_after_produces_valid_fixture,
        test_sea_fill_placeholder_produces_valid_fixture,
        test_sea_combined_operations_produce_valid_fixture,
        test_froala_delete_produces_valid_fixture,
        test_froala_replace_produces_valid_fixture,
        test_froala_fill_placeholder_produces_valid_fixture,
        test_froala_combined_operations_produce_valid_fixture,
        test_save_raises_when_no_changes_applied,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"  PASS  {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {test.__name__}: {e}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
    if failed:
        sys.exit(1)
