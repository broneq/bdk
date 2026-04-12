"""Unit tests for SEAFixtureBuilder — plain assert, runs standalone with python3."""

from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts", "fixture_builder"))
from sea_builder import SEAFixtureBuilder

USERID = "297329"
USERNAME = "297329CP"

MINIMAL_SEA_HTML = (
    '<div class="single-editor cpm-main-clause">'
    "<p>Steamship/Motor Vessel called "
    '<dfplaceholder id="cke_36_df_0" contenteditable="false" dfsystemname="VESSEL_NAME" '
    'title="Vessel Name">&nbsp;</dfplaceholder>'
    " and expected ready to load.</p></div>"
)


def _make_builder(html: str | None = None) -> SEAFixtureBuilder:
    return SEAFixtureBuilder("/fake/template.html", html or MINIMAL_SEA_HTML, USERID, USERNAME)


def test_wrap_deletion_has_correct_classes() -> None:
    b = _make_builder()
    result = b._wrap_deletion("text")
    assert "ice-del" in result, f"Missing ice-del: {result}"
    assert "ice-cts-" in result, f"Missing ice-cts-N: {result}"
    assert "cpm-change-previous" in result, f"Missing cpm-change-previous: {result}"
    assert "<del " in result, f"Expected <del> tag: {result}"
    assert ">text</del>" in result, f"Expected text content: {result}"


def test_wrap_deletion_has_required_attributes() -> None:
    b = _make_builder()
    result = b._wrap_deletion("text")
    for attr in [
        "data-cid",
        "data-userid",
        "data-username",
        "data-time",
        "data-last-change-time",
        "data-changedata",
    ]:
        assert attr in result, f"Missing attribute {attr}: {result}"


def test_wrap_insertion_has_correct_tag_and_classes() -> None:
    b = _make_builder()
    result = b._wrap_insertion("text")
    assert "<ins " in result, f"Expected <ins> tag: {result}"
    assert "ice-ins" in result, f"Missing ice-ins: {result}"
    assert "cpm-change-previous" in result, f"Missing cpm-change-previous: {result}"


def test_wrap_insertion_has_required_attributes() -> None:
    b = _make_builder()
    result = b._wrap_insertion("text")
    for attr in [
        "data-cid",
        "data-userid",
        "data-username",
        "data-time",
        "data-last-change-time",
        "data-changedata",
    ]:
        assert attr in result, f"Missing attribute {attr}: {result}"


def test_build_replacement_shared_cid() -> None:
    b = _make_builder()
    result = b._build_replacement("old", "new")
    cids = re.findall(r'data-cid="(\d+)"', result)
    assert len(cids) == 2, f"Expected 2 data-cid attributes, got {len(cids)}: {result}"
    assert cids[0] == cids[1], f"CIDs should match: {cids[0]} != {cids[1]}"
    assert "<del " in result and "<ins " in result


def test_fill_placeholder_replaces_nbsp() -> None:
    b = _make_builder()
    result = b._fill_placeholder_html("cke_36_df_0", "Singapore")
    assert result is not None, "fill_placeholder_html returned None"
    assert "Singapore" in result
    assert "&nbsp;" not in result.split("cke_36_df_0")[1].split("</dfplaceholder>")[0]


def test_fill_placeholder_nonexistent_returns_none() -> None:
    b = _make_builder()
    result = b._fill_placeholder_html("nonexistent_id", "val")
    assert result is None, f"Expected None for nonexistent id, got: {result!r:.100}"


def test_delete_wraps_in_del_tag() -> None:
    b = _make_builder()
    b.delete("Steamship/Motor")
    assert "<del " in b._html
    assert "Steamship/Motor</del>" in b._html


def test_delete_missing_deferred_to_save() -> None:
    b = _make_builder()
    b.delete("NONEXISTENT TEXT")  # should not raise immediately
    assert len(b._errors) == 1, f"Expected 1 deferred error, got {b._errors}"
    assert "not found" in b._errors[0]


def test_replace_produces_adjacent_del_ins() -> None:
    b = _make_builder()
    b.replace("Steamship/Motor", "Motor")
    assert "<del " in b._html and "<ins " in b._html
    cids = re.findall(r'data-cid="(\d+)"', b._html)
    assert len(cids) >= 2
    assert cids[0] == cids[1]


def test_insert_after_places_ins_after_anchor() -> None:
    b = _make_builder()
    b.insert_after("Vessel called", " approximately")
    assert "Vessel called" in b._html
    idx_anchor = b._html.find("Vessel called")
    idx_ins = b._html.find("<ins ", idx_anchor)
    assert idx_ins > idx_anchor, "ins should appear after anchor"


FREETEXTFIELD_SINGLE_HTML = (
    "<table><tr><td>"
    '<freetextfield class="sc-dotted" style="min-width:20px;">'
    "&nbsp;&nbsp;&nbsp;</freetextfield>"
    "</td></tr></table>"
)

FREETEXTFIELD_TWO_HTML = (
    '<freetextfield class="sc-dotted">&nbsp;</freetextfield>'
    " text "
    '<freetextfield class="sc-dotted">&nbsp;&nbsp;&nbsp;</freetextfield>'
)

FREETEXTFIELD_ONE_HTML = "<freetextfield>&nbsp;</freetextfield>"


def test_fill_freetextfield_replaces_nbsp() -> None:
    b = _make_builder(FREETEXTFIELD_SINGLE_HTML)
    result = b._fill_freetextfield_html(1, "Port Value")
    assert result is not None, "Expected result, got None"
    assert "Port Value" in result, f"Expected 'Port Value' in result: {result!r}"
    assert "&nbsp;&nbsp;&nbsp;" not in result, f"nbsp should be replaced: {result!r}"


def test_fill_freetextfield_second_of_two() -> None:
    b = _make_builder(FREETEXTFIELD_TWO_HTML)
    result = b._fill_freetextfield_html(2, "Second")
    assert result is not None, "Expected result, got None"
    assert "Second" in result, f"Expected 'Second' in result: {result!r}"
    assert result.count("<freetextfield") == 2, f"Both freetextfield tags should remain: {result!r}"
    assert result.count("</freetextfield>") == 2, f"Both closing tags should remain: {result!r}"


def test_fill_freetextfield_not_found_returns_none() -> None:
    b = _make_builder(FREETEXTFIELD_ONE_HTML)
    result = b._fill_freetextfield_html(99, "value")
    assert result is None, f"Expected None for nonexistent index, got: {result!r}"


def test_fill_freetextfield_public_method_updates_html() -> None:
    b = _make_builder(FREETEXTFIELD_SINGLE_HTML)
    b.fill_freetextfield(1, "Hamburg")
    assert "Hamburg" in b._html, f"Expected 'Hamburg' in html: {b._html!r}"


def test_fill_freetextfield_public_method_not_found_deferred() -> None:
    b = _make_builder(FREETEXTFIELD_ONE_HTML)
    b.fill_freetextfield(99, "value")  # should not raise immediately
    assert len(b._errors) == 1, f"Expected 1 deferred error, got {b._errors}"
    assert "99" in b._errors[0], f"Error message should include index 99: {b._errors[0]}"


def test_multiple_errors_collected_and_raised_at_save() -> None:
    b = _make_builder()
    b.delete("NONEXISTENT ONE")
    b.delete("NONEXISTENT TWO")
    b.fill_placeholder("bad_id", "x")
    assert len(b._errors) == 3, f"Expected 3 deferred errors, got {b._errors}"
    try:
        b.save("out.html")
        raise AssertionError("Expected ValueError from save()")
    except ValueError as e:
        msg = str(e)
        assert "3 operation(s) failed" in msg, f"Expected count in message: {msg}"
        assert "[1]" in msg and "[2]" in msg and "[3]" in msg, f"Expected numbered list: {msg}"


if __name__ == "__main__":
    test_wrap_deletion_has_correct_classes()
    test_wrap_deletion_has_required_attributes()
    test_wrap_insertion_has_correct_tag_and_classes()
    test_wrap_insertion_has_required_attributes()
    test_build_replacement_shared_cid()
    test_fill_placeholder_replaces_nbsp()
    test_fill_placeholder_nonexistent_returns_none()
    test_delete_wraps_in_del_tag()
    test_delete_missing_deferred_to_save()
    test_replace_produces_adjacent_del_ins()
    test_insert_after_places_ins_after_anchor()
    test_fill_freetextfield_replaces_nbsp()
    test_fill_freetextfield_second_of_two()
    test_fill_freetextfield_not_found_returns_none()
    test_fill_freetextfield_public_method_updates_html()
    test_fill_freetextfield_public_method_not_found_deferred()
    test_multiple_errors_collected_and_raised_at_save()
    print("All SEAFixtureBuilder tests passed!")
