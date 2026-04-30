#!/usr/bin/env python3
"""Resolve quality rule content based on .bdk/settings.json overrides.

Usage:
    python3 inject-rules.py <rule-name>

Reads BDK default at ${CLAUDE_PLUGIN_ROOT}/rules/<name>.md, optionally
merges or replaces with user file from .bdk/settings.json `quality.<name>`
entry, prints final content to stdout.

Public API:
    from inject_rules import resolve_rule
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _load_settings(start: Path) -> dict | None:
    import json
    current = start.resolve()
    while True:
        candidate = current / ".bdk" / "settings.json"
        if candidate.exists():
            try:
                return json.loads(candidate.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                return None
        parent = current.parent
        if parent == current:
            return None
        current = parent


def _default_plugin_root() -> Path:
    """Resolve plugin root from CLAUDE_PLUGIN_ROOT env var, falling back to script location.

    Slash-command frontmatter substitutes ${CLAUDE_PLUGIN_ROOT} but does not export it
    to the spawned shell. Use the script's own location (scripts/inject-rules.py →
    plugin root is parent of scripts/) as a robust fallback.
    """
    env = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent


def resolve_rule(name: str, cwd: Path | None = None, plugin_root: Path | None = None) -> str:
    """Resolve final rule content for `name`. Returns content string.

    Raises FileNotFoundError, ValueError, OSError on misconfigurations.
    """
    cwd = cwd or Path.cwd()
    plugin_root = plugin_root or _default_plugin_root()
    default_path = plugin_root / "rules" / f"{name}.md"

    settings = _load_settings(cwd)
    quality = (settings or {}).get("quality", {}) if settings else {}
    entry = quality.get(name) if isinstance(quality, dict) else None

    if entry is None:
        if not default_path.exists():
            raise FileNotFoundError(f"BDK default not found: {default_path}")
        return default_path.read_text(encoding="utf-8")

    # Normalise entry to {path, mode}
    if isinstance(entry, str):
        normalised = {"path": entry, "mode": "extends"}
    elif isinstance(entry, dict):
        if "path" not in entry:
            raise ValueError(f"quality.{name}: 'path' is required in object form")
        mode = entry.get("mode", "extends")
        if mode not in ("extends", "replace"):
            print(
                f"[BDK inject-rules] quality.{name}: unknown mode {mode!r}, treating as 'extends'",
                file=sys.stderr,
            )
            mode = "extends"
        normalised = {"path": entry["path"], "mode": mode}
    else:
        raise ValueError(f"quality.{name}: must be string or object, got {type(entry).__name__}")

    user_path = Path(normalised["path"])
    if not user_path.is_absolute():
        user_path = cwd / user_path
    if not user_path.exists():
        raise FileNotFoundError(f"quality.{name}: user file not found: {user_path}")
    user_content = user_path.read_text(encoding="utf-8")

    if normalised["mode"] == "replace":
        return user_content

    # extends mode
    if not default_path.exists():
        raise FileNotFoundError(f"BDK default not found (required for extends mode): {default_path}")
    default_content = default_path.read_text(encoding="utf-8")
    return f"{default_content}\n\n{user_content}"


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: inject-rules.py <rule-name>", file=sys.stderr)
        sys.exit(1)
    name = sys.argv[1]
    try:
        content = resolve_rule(name)
    except (FileNotFoundError, ValueError, OSError) as e:
        print(f"[BDK inject-rules] {e}", file=sys.stderr)
        sys.exit(1)
    print(content, end="")
    sys.exit(0)


if __name__ == "__main__":
    main()
