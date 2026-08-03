#!/usr/bin/env python3
"""Resolve language-specific rule content based on .bdk/settings.json.

Reads `languages` list from settings, then for each entry resolves
`rules/languages/<lang>.md` from the plugin root. Optional per-language
override via `language-rules.<lang>` (same `extends` | `replace` semantics
as `quality.<name>` in inject-rules.py).

Usage:
    python3 inject-language-rules.py                  # all configured languages
    python3 inject-language-rules.py <lang>           # one language only

Behaviour:
    - No settings file → silent exit 0 (graceful for non-BDK projects)
    - Settings present, no `languages` → silent exit 0
    - Language listed but no rule file (default or override) → silent skip
    - Multiple languages → concatenated with blank-line separator

Public API:
    from inject_language_rules import resolve_language_rule, resolve_all
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def _load_settings(start: Path) -> dict | None:  # type: ignore[type-arg]
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
    env = os.environ.get("CLAUDE_PLUGIN_ROOT")
    if env:
        return Path(env)
    return Path(__file__).resolve().parent.parent


def _normalise_override(entry: object, lang: str) -> dict | None:  # type: ignore[type-arg]
    if entry is None:
        return None
    if isinstance(entry, str):
        return {"path": entry, "mode": "extends"}
    if isinstance(entry, dict):
        if "path" not in entry:
            raise ValueError(
                f"language-rules.{lang}: 'path' is required in object form"
            )
        mode = entry.get("mode", "extends")
        if mode not in ("extends", "replace"):
            print(
                f"[BDK inject-language-rules] language-rules.{lang}: "
                f"unknown mode {mode!r}, treating as 'extends'",
                file=sys.stderr,
            )
            mode = "extends"
        return {"path": entry["path"], "mode": mode}
    raise ValueError(
        f"language-rules.{lang}: must be string or object, got {type(entry).__name__}"
    )


def resolve_language_rule(
    lang: str,
    cwd: Path | None = None,
    plugin_root: Path | None = None,
) -> str | None:
    """Resolve final rule content for one language. Returns None when nothing applies."""
    cwd = cwd or Path.cwd()
    plugin_root = plugin_root or _default_plugin_root()
    default_path = plugin_root / "rules" / "languages" / f"{lang}.md"

    settings = _load_settings(cwd)
    overrides = (settings or {}).get("language-rules", {}) if settings else {}
    entry = overrides.get(lang) if isinstance(overrides, dict) else None
    override = _normalise_override(entry, lang)

    default_content = default_path.read_text(encoding="utf-8") if default_path.exists() else None

    if override is None:
        return default_content

    user_path = Path(override["path"])
    if not user_path.is_absolute():
        user_path = cwd / user_path
    if not user_path.exists():
        raise FileNotFoundError(
            f"language-rules.{lang}: user file not found: {user_path}"
        )
    user_content = user_path.read_text(encoding="utf-8")

    if override["mode"] == "replace":
        return user_content

    # extends mode
    if default_content is None:
        return user_content
    return f"{default_content}\n\n{user_content}"


def resolve_all(
    cwd: Path | None = None,
    plugin_root: Path | None = None,
) -> str:
    """Resolve rules for every language in settings. Returns concatenated content."""
    cwd = cwd or Path.cwd()
    plugin_root = plugin_root or _default_plugin_root()

    settings = _load_settings(cwd)
    if settings is None:
        return ""
    languages = settings.get("languages")
    if not isinstance(languages, list) or not languages:
        return ""

    parts: list[str] = []
    for lang in languages:
        if not isinstance(lang, str):
            continue
        content = resolve_language_rule(lang, cwd=cwd, plugin_root=plugin_root)
        if content:
            parts.append(content.rstrip())
    return "\n\n".join(parts)


def main() -> None:
    if len(sys.argv) > 2:
        print(
            "Usage: inject-language-rules.py [<lang>]",
            file=sys.stderr,
        )
        sys.exit(1)

    try:
        if len(sys.argv) == 2:
            content = resolve_language_rule(sys.argv[1])
            if content:
                print(content, end="")
        else:
            content = resolve_all()
            if content:
                print(content, end="")
    except (FileNotFoundError, ValueError, OSError) as e:
        print(f"[BDK inject-language-rules] {e}", file=sys.stderr)
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
