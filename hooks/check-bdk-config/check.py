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

INVALID_REASON = """\
.bdk/settings.json is malformed or failed validation.

Run /bdk:setup --force to regenerate it."""

_TOOL_ARRAY_KEYS = ("test-tools", "lint-tools", "build-tools")

_TIERS = ("fast", "e2e", "lint", "format", "typecheck")

# Templates the caller fills with a path list. A template without the
# placeholder silently degrades to a whole-project run at every per-group
# check — the exact cost the tier system exists to remove — so it is an error,
# not a warning.
_PLACEHOLDER_FIELDS = ("scoped", "related")
_TEMPLATE_FIELDS = ("scoped", "related", "failed", "incremental")


def _validate_tool(key: str, i: int, t: dict) -> list[str]:  # type: ignore[type-arg]
    errors = []
    where = f"'{key}[{i}]"
    if "command" not in t or not isinstance(t["command"], str) or not t["command"].strip():
        errors.append(f"{where}.command' must be a non-empty string")

    tier = t.get("tier")
    if tier is not None and tier not in _TIERS:
        errors.append(f"{where}.tier' must be one of {', '.join(_TIERS)} (got {tier!r})")

    for field in _TEMPLATE_FIELDS:
        value = t.get(field)
        if value is None:
            continue
        if not isinstance(value, str) or not value.strip():
            errors.append(f"{where}.{field}' must be a non-empty string")
        elif field in _PLACEHOLDER_FIELDS and "{files}" not in value:
            errors.append(
                f"{where}.{field}' must contain the '{{files}}' placeholder — "
                f"without it the command ignores the file list and runs everything"
            )
    return errors


def validate_settings(settings: dict) -> list[str]:  # type: ignore[type-arg]
    """Return list of validation error strings. Empty = valid."""
    errors = []
    if not isinstance(settings, dict):
        return ["root must be an object"]

    languages = settings.get("languages")
    if languages is not None:
        if not isinstance(languages, list) or not all(isinstance(l, str) for l in languages):
            errors.append("'languages' must be array of strings")

    for key in _TOOL_ARRAY_KEYS:
        tools = settings.get(key)
        if tools is None:
            continue
        if not isinstance(tools, list):
            errors.append(f"'{key}' must be an array")
            continue
        for i, t in enumerate(tools):
            if not isinstance(t, dict):
                errors.append(f"'{key}[{i}]' must be an object")
            else:
                errors.extend(_validate_tool(key, i, t))

    features = settings.get("features")
    if features is not None:
        if not isinstance(features, dict):
            errors.append("'features' must be an object")
        else:
            for k, v in features.items():
                if not isinstance(v, bool):
                    errors.append(f"'features.{k}' must be a boolean")

    return errors


def read_stdin_json() -> dict:  # type: ignore[type-arg]
    """Read hook input from stdin."""
    try:
        return json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        return {}


def _format_tools(tools: list[dict]) -> str:  # type: ignore[type-arg]
    """Format a list of tool dicts as 'command (type, tier), command2 (type2)'.

    The tier rides along because the session summary is where the orchestrator
    learns which command is the expensive one; the scoped templates themselves
    are read on demand via `get_settings.py`, not injected at every session
    start.
    """
    parts = []
    for t in tools:
        cmd = t.get("command", "")
        if not cmd:
            continue
        labels = [str(v) for v in (t.get("type"), t.get("tier")) if v]
        parts.append(f"{cmd} ({', '.join(labels)})" if labels else cmd)
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

    errors = validate_settings(settings)
    if errors:
        detail = "\n".join(f"  - {e}" for e in errors)
        reason = f"{INVALID_REASON}\n\nErrors:\n{detail}"
        print(json.dumps({"decision": "block", "reason": reason}))
        sys.exit(0)

    print(format_settings_context(settings))
    sys.exit(0)


if __name__ == "__main__":
    main()
