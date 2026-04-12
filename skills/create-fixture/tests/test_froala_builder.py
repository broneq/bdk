"""Unit tests for FroalaFixtureBuilder — plain assert, runs standalone with python3."""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts", "fixture_builder"))
from froala_builder import FroalaFixtureBuilder

USER_UUID = "53b51b06-ca6e-4ad5-83a6-fd0a78fa76b1"

MINIMAL_FROALA_HTML = (
    '<div class="fr-element fr-view">'
    '<table class="no-borders"><tr><td>'
    "Steamship/Motor Vessel called "
    '<a data-recap-type="addition" data-recap-id="vessel-name" contenteditable="false"></a>'
    " and expected ready to load."
    "</td></tr></table></div>"
)


def _make_builder(html: str | None = None) -> FroalaFixtureBuilder:
    return FroalaFixtureBuilder("/fake/template.html", html or MINIMAL_FROALA_HTML, USER_UUID)


def test_wrap_deletion_correct_class() -> None:
    b = _make_builder()
    result = b._wrap_deletion("text")
    assert "fr-tracking-deleted" in result, f"Missing fr-tracking-deleted: {result}"
    assert 'data-change-type="deletion"' in result
    assert "<span " in result


def test_wrap_deletion_has_required_attributes() -> None:
    b = _make_builder()
    result = b._wrap_deletion("text")
    for attr in ["data-timestamp", "data-identifier", "data-user"]:
        assert attr in result, f"Missing {attr}: {result}"
    # Check timestamp is 13 digits
    ts = re.search(r'data-timestamp="(\d+)"', result)
    assert ts and len(ts.group(1)) == 13, f"Timestamp should be 13 digits: {ts}"


def test_wrap_insertion_correct_class() -> None:
    b = _make_builder()
    result = b._wrap_insertion("text")
    assert "fr-highlight-change" in result
    assert 'data-change-type="addition"' in result


def test_build_replacement_different_uuids() -> None:
    b = _make_builder()
    result = b._build_replacement("old", "new")
    uuids = re.findall(r'data-identifier="([^"]+)"', result)
    assert len(uuids) == 2, f"Expected 2 data-identifier, got {len(uuids)}"
    assert uuids[0] != uuids[1], f"UUIDs should differ: {uuids[0]} == {uuids[1]}"
    assert "fr-tracking-deleted" in result
    assert "fr-highlight-change" in result


def test_fill_placeholder_appends_after_anchor() -> None:
    b = _make_builder()
    result = b._fill_placeholder_html("vessel-name", "MV STAR")
    assert result is not None, "fill_placeholder_html returned None"
    assert "MV STAR" in result
    # Addition span should appear after the anchor
    anchor_end = result.find('contenteditable="false"></a>')
    assert anchor_end > 0
    assert "fr-highlight-change" in result[anchor_end:]


def test_fill_placeholder_nonexistent_returns_none() -> None:
    b = _make_builder()
    result = b._fill_placeholder_html("nonexistent-id", "val")
    assert result is None


def test_delete_wraps_in_span() -> None:
    b = _make_builder()
    b.delete("Steamship/Motor")
    assert "fr-tracking-deleted" in b._html
    assert "Steamship/Motor</span>" in b._html


def test_delete_missing_deferred_to_save() -> None:
    b = _make_builder()
    b.delete("NONEXISTENT TEXT")  # should not raise immediately
    assert len(b._errors) == 1, f"Expected 1 deferred error, got {b._errors}"
    assert "not found" in b._errors[0]


def test_replace_produces_deletion_and_addition() -> None:
    b = _make_builder()
    b.replace("Steamship/Motor", "Motor")
    assert "fr-tracking-deleted" in b._html
    assert "fr-highlight-change" in b._html


def test_insert_after_places_span_after_anchor() -> None:
    b = _make_builder()
    b.insert_after("Vessel called", " approximately")
    idx_anchor = b._html.find("Vessel called")
    idx_span = b._html.find("fr-highlight-change", idx_anchor)
    assert idx_span > idx_anchor, "Addition span should appear after anchor"


if __name__ == "__main__":
    test_wrap_deletion_correct_class()
    test_wrap_deletion_has_required_attributes()
    test_wrap_insertion_correct_class()
    test_build_replacement_different_uuids()
    test_fill_placeholder_appends_after_anchor()
    test_fill_placeholder_nonexistent_returns_none()
    test_delete_wraps_in_span()
    test_delete_missing_deferred_to_save()
    test_replace_produces_deletion_and_addition()
    test_insert_after_places_span_after_anchor()
    print("All FroalaFixtureBuilder tests passed!")
