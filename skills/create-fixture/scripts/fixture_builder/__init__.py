"""Fixture builder library — auto-detects format and returns the appropriate builder."""

from __future__ import annotations

import sys
from pathlib import Path

# detection.py is a sibling of the fixture_builder/ package
sys.path.insert(0, str(Path(__file__).parent.parent))
from detection import detect_format, detect_subtype, user_uuid  # type: ignore[import-not-found]

from .froala_builder import FroalaFixtureBuilder
from .sea_builder import SEAFixtureBuilder


class FixtureBuilder:
    """Factory for format-specific fixture builders."""

    @staticmethod
    def from_template(path: str) -> SEAFixtureBuilder | FroalaFixtureBuilder:
        """Auto-detect format and return appropriate builder."""
        html = Path(path).read_text(encoding="utf-8")
        fmt = detect_format(html)
        if fmt == "sea":
            return SEAFixtureBuilder(path, html, "297329", "297329CP")
        if fmt == "froala":
            subtype = detect_subtype(html)
            return FroalaFixtureBuilder(path, html, user_uuid(subtype))
        raise ValueError(
            f'Unknown format for template: "{path}"\n'
            "  Expected Froala (fr-element/fr-view) or SEA (cpm-main-clause/ice-ins/ice-del)"
        )
