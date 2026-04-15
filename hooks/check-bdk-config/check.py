#!/usr/bin/env python3
"""SessionStart hook: inject .bdk/settings.json context or block if missing.

If .bdk/settings.json exists in the project root:
    Prints a compact settings summary appended to STARTUP_INSTRUCTIONS context.

If missing or malformed:
    Prints decision=block JSON instructing user to run /bdk:setup.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BLOCK_REASON = """\
BDK project settings not found (.bdk/settings.json missing).

Run /bdk:setup to configure this project before proceeding.
Setup probes your project files and records test/lint/build commands.
Until setup is complete, skills that rely on project settings will not work correctly."""


def read_stdin_json() -> dict:  # type: ignore[type-arg]
    """Read hook input from stdin."""
    try:
        return json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        return {}


def _format_tools(tools: list[dict]) -> str:  # type: ignore[type-arg]
    """Format a list of tool dicts as 'command (type), command2 (type2)'."""
    parts = []
    for t in tools:
        cmd = t.get("command", "")
        typ = t.get("type", "")
        if cmd and typ:
            parts.append(f"{cmd} ({typ})")
        elif cmd:
            parts.append(cmd)
    return ", ".join(parts)


def format_settings_context(settings: dict) -> str:  # type: ignore[type-arg]
    """Format settings dict as compact human-readable context block."""
    lines = ["---", "## BDK Project Settings (.bdk/settings.json)", ""]

    languages = settings.get("languages", [])
    if languages:
        lines.append(f"Languages: {', '.join(languages)}")

    test_tools = settings.get("test-tools", [])
    if test_tools:
        lines.append(f"Test commands: {_format_tools(test_tools)}")

    lint_tools = settings.get("lint-tools", [])
    if lint_tools:
        lines.append(f"Lint commands: {_format_tools(lint_tools)}")

    build_tools = settings.get("build-tools", [])
    if build_tools:
        lines.append(f"Build commands: {_format_tools(build_tools)}")

    features = settings.get("features", {})
    if features:
        feature_parts = [f"{k}={'on' if v else 'off'}" for k, v in features.items()]
        lines.append(f"Features: {', '.join(feature_parts)}")

    return "\n".join(lines)


def main() -> None:
    read_stdin_json()  # consume stdin (hook protocol)

    settings_path = Path(".bdk/settings.json")

    if not settings_path.exists():
        print(json.dumps({"decision": "block", "reason": BLOCK_REASON}))
        sys.exit(0)

    try:
        settings = json.loads(settings_path.read_text())
    except (json.JSONDecodeError, OSError):
        print(json.dumps({"decision": "block", "reason": BLOCK_REASON}))
        sys.exit(0)

    print(format_settings_context(settings))
    sys.exit(0)


if __name__ == "__main__":
    main()
