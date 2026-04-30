#!/usr/bin/env python3
"""CLI utility: read a specific key from .bdk/settings.json and print it.

Usage:
    python3 get_settings.py <key>

Keys:
    languages       → typescript, react, next
    test-tools      → npm run test:unit (vitest), npm run test:e2e (playwright)
    lint-tools      → npm run lint (eslint)
    build-tools     → npm run build (tsc)
    features        → caveman=on, serena=on, code-review-graph=off

Exits 0 on success, 1 if settings file missing or key not found.

Intended for use in skill/agent prompts via:
    ! python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SETTINGS_PATH = Path(".bdk/settings.json")

TOOL_KEYS = {"test-tools", "lint-tools", "build-tools"}


def _format_tools(tools: list[dict]) -> str:  # type: ignore[type-arg]
    parts = []
    for t in tools:
        cmd = t.get("command", "")
        typ = t.get("type", "")
        if cmd and typ:
            parts.append(f"{cmd} ({typ})")
        elif cmd:
            parts.append(cmd)
    return ", ".join(parts)


def _format_features(features: dict) -> str:  # type: ignore[type-arg]
    return ", ".join(f"{k}={'on' if v else 'off'}" for k, v in features.items())


def get_value(settings: dict, key: str) -> str | None:  # type: ignore[type-arg]
    """Extract and format a single key from settings. Returns None if not present."""
    value = settings.get(key)
    if value is None:
        return None

    if key == "languages":
        if isinstance(value, list):
            return ", ".join(value)
        return str(value)

    if key in TOOL_KEYS:
        if isinstance(value, list):
            return _format_tools(value)
        return str(value)

    if key == "features":
        if isinstance(value, dict):
            return _format_features(value)
        return str(value)

    # Fallback: dump as-is
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return str(value)


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: get_settings.py <key>  (languages|test-tools|lint-tools|build-tools|features)",
            file=sys.stderr,
        )
        sys.exit(1)

    key = sys.argv[1]

    if not SETTINGS_PATH.exists():
        print(
            f"[BDK] .bdk/settings.json not found. Run /bdk:setup first.",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        settings = json.loads(SETTINGS_PATH.read_text())
    except (json.JSONDecodeError, OSError) as e:
        print(f"[BDK] Failed to read .bdk/settings.json: {e}", file=sys.stderr)
        sys.exit(1)

    result = get_value(settings, key)
    if result is None:
        print(f"[BDK] Key '{key}' not found in .bdk/settings.json", file=sys.stderr)
        sys.exit(1)

    print(result)
    sys.exit(0)


if __name__ == "__main__":
    main()
