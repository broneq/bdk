"""Unit tests for FixtureBuilder factory — plain assert, runs standalone with python3."""

from __future__ import annotations

import os
import sys
import tempfile

# Add scripts/ to path so fixture_builder package can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))

from fixture_builder import FixtureBuilder
from fixture_builder.froala_builder import FroalaFixtureBuilder
from fixture_builder.sea_builder import SEAFixtureBuilder


def _write_temp_html(content: str) -> str:
    """Write HTML to a temp file and return its path."""
    fd, path = tempfile.mkstemp(suffix=".html")
    with os.fdopen(fd, "w") as f:
        f.write(content)
    return path


SEA_HTML = '<div class="cpm-main-clause"><p>Hello</p></div>'
FROALA_HTML = '<div class="fr-element fr-view"><p>Hello</p></div>'
UNKNOWN_HTML = "<div><p>Hello</p></div>"


def test_from_template_sea() -> None:
    path = _write_temp_html(SEA_HTML)
    try:
        b = FixtureBuilder.from_template(path)
        assert isinstance(b, SEAFixtureBuilder), f"Expected SEAFixtureBuilder, got {type(b)}"
    finally:
        os.unlink(path)


def test_from_template_froala() -> None:
    path = _write_temp_html(FROALA_HTML)
    try:
        b = FixtureBuilder.from_template(path)
        assert isinstance(b, FroalaFixtureBuilder), f"Expected FroalaFixtureBuilder, got {type(b)}"
    finally:
        os.unlink(path)


def test_from_template_unknown_raises() -> None:
    path = _write_temp_html(UNKNOWN_HTML)
    try:
        try:
            FixtureBuilder.from_template(path)
            raise AssertionError("Expected ValueError for unknown format")
        except ValueError as e:
            assert "unknown" in str(e).lower(), f"Expected 'unknown' in error: {e}"
    finally:
        os.unlink(path)


if __name__ == "__main__":
    test_from_template_sea()
    test_from_template_froala()
    test_from_template_unknown_raises()
    print("All FixtureBuilder factory tests passed!")
