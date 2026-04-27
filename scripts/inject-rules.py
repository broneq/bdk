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


def resolve_rule(name: str, cwd: Path | None = None, plugin_root: Path | None = None) -> str:
    """Resolve final rule content for `name`. Returns content string.

    Raises FileNotFoundError, ValueError, OSError on misconfigurations.
    """
    cwd = cwd or Path.cwd()
    plugin_root = plugin_root or Path(os.environ["CLAUDE_PLUGIN_ROOT"])
    default_path = plugin_root / "rules" / f"{name}.md"

    settings = _load_settings(cwd)
    quality = (settings or {}).get("quality", {}) if settings else {}
    entry = quality.get(name) if isinstance(quality, dict) else None

    if entry is None:
        if not default_path.exists():
            raise FileNotFoundError(f"BDK default not found: {default_path}")
        return default_path.read_text(encoding="utf-8")

    raise NotImplementedError("entry handling — implemented in later task")


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
