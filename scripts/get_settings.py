#!/usr/bin/env python3
"""CLI utility: read a specific key from .bdk/settings.json and print it.

Usage:
    python3 get_settings.py <key>

Keys:
    languages       → typescript, react, next
    test-tools      → one block per tier (full / scoped / related / failed)
    lint-tools      → one block per tier (full / scoped / incremental)
    build-tools     → one block per tool
    features        → caveman=on, serena=on, code-review-graph=off

Tool keys emit a block per entry rather than a flat prose string, because the
scoping form of a command is what callers actually need most of the time and
prose forces every agent to re-derive it (`npm run test:unit -- <path>`?
`vitest related`? `playwright --grep`?). A block looks like:

    tier=fast type=vitest
      full:     npm run test:unit
      scoped:   npx vitest run {files}
      related:  npx vitest related --run {files}
      failed:   npx vitest run --changed

`{files}` is substituted by the caller with a space-separated path list.
`tier` is inferred from the tool name when the entry does not declare one, and
the inference is marked so the reader can tell a guess from a declaration.

Exits 0 always (key missing or settings absent → prints generic fallback to stdout).
Exits 1 only if the settings file exists but is unparseable JSON.

Intended for use in skill/agent prompts via:
    ! python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SETTINGS_PATH = Path(".bdk/settings.json")

TOOL_KEYS = {"test-tools", "lint-tools", "build-tools"}

# Emitted in this order, under these labels. `command` is the full/unscoped form
# and is labelled `full` to make its cost explicit at every read site.
TEMPLATE_FIELDS: tuple[tuple[str, str], ...] = (
    ("command", "full"),
    ("scoped", "scoped"),
    ("related", "related"),
    ("failed", "failed"),
    ("incremental", "incremental"),
)

_E2E_PATTERN = re.compile(
    r"e2e|playwright|cypress|selenium|puppeteer|nightwatch|integration", re.I
)
_TYPECHECK_PATTERN = re.compile(r"tsc|typecheck|type-check|mypy|pyright|flow", re.I)
_FORMAT_PATTERN = re.compile(r"prettier|black|gofmt|rustfmt|fmt|format", re.I)


def infer_tier(key: str, tool: dict) -> str | None:  # type: ignore[type-arg]
    """Guess a tier from the tool's name and command when it declares none.

    The whole scoped-first policy hinges on knowing which command is the slow
    one, so a settings file written before `tier` existed must still be usable.
    """
    haystack = f"{tool.get('type', '')} {tool.get('command', '')}"
    if key == "test-tools":
        return "e2e" if _E2E_PATTERN.search(haystack) else "fast"
    if key == "lint-tools":
        if _TYPECHECK_PATTERN.search(haystack):
            return "typecheck"
        if _FORMAT_PATTERN.search(haystack):
            return "format"
        return "lint"
    return None


def _format_tool(key: str, tool: dict) -> list[str]:  # type: ignore[type-arg]
    declared_tier = tool.get("tier")
    tier = declared_tier or infer_tier(key, tool)

    header_parts = []
    if tier:
        header_parts.append(f"tier={tier}")
    if tool.get("type"):
        header_parts.append(f"type={tool['type']}")
    header = " ".join(header_parts) or "tool"
    if tier and not declared_tier:
        header += " (tier inferred)"

    lines = [header]
    for field, label in TEMPLATE_FIELDS:
        value = tool.get(field)
        if isinstance(value, str) and value.strip():
            lines.append(f"  {label + ':':13}{value}")
    return lines


def _format_tools(key: str, tools: list[dict]) -> str:  # type: ignore[type-arg]
    blocks = []
    for tool in tools:
        if not isinstance(tool, dict) or not tool.get("command"):
            continue
        blocks.extend(_format_tool(key, tool))
    return "\n".join(blocks)


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
            return _format_tools(key, value) or None
        return str(value)

    if key == "features":
        if isinstance(value, dict):
            return _format_features(value)
        return str(value)

    # Fallback: dump as-is
    if isinstance(value, (list, dict)):
        return json.dumps(value)
    return str(value)


_FALLBACKS: dict[str, str] = {
    "test-tools": "run the project's test suite",
    "lint-tools": "run the project's linter/formatter",
    "build-tools": "build the project",
    "languages": "auto-detect from project files",
    "features": "(no features configured)",
}


def _fallback(key: str) -> str:
    return _FALLBACKS.get(key, f"(no value configured for '{key}')")


def main() -> None:
    if len(sys.argv) < 2:
        print(
            "Usage: get_settings.py <key>  (languages|test-tools|lint-tools|build-tools|features)",
            file=sys.stderr,
        )
        sys.exit(1)

    key = sys.argv[1]

    fallback = _fallback(key)

    if not SETTINGS_PATH.exists():
        print(fallback)
        sys.exit(0)

    try:
        settings = json.loads(SETTINGS_PATH.read_text())
    except (json.JSONDecodeError, OSError) as e:
        print(f"[BDK] Failed to read .bdk/settings.json: {e}", file=sys.stderr)
        sys.exit(1)

    result = get_value(settings, key)
    if result is None:
        print(fallback)
        sys.exit(0)

    print(result)
    sys.exit(0)


if __name__ == "__main__":
    main()
