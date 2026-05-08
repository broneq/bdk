#!/usr/bin/env python3
"""Render STARTUP_INSTRUCTIONS.md with chain markers expanded.

Replaces dead Flow 2 from docs/INJECTION-FLOWS.md: the SessionStart hook
used to `cat` STARTUP_INSTRUCTIONS.md, but the !-blocks inside it never
re-evaluate — Claude Code's dynamic-injection only runs in skill bodies,
not in hook stdout. This script does the substitution itself before the
hook returns, so chain content reaches the model.

Usage:
    python3 render_startup.py
    python3 render_startup.py --source /custom/path/STARTUP_INSTRUCTIONS.md
    python3 render_startup.py --settings /custom/.bdk/settings.json

Marker syntax in STARTUP_INSTRUCTIONS.md:

    <!-- CHAIN: explore.chain.json -->

Path is resolved relative to fragments/tool-tiers/. Whole marker line
is replaced with the chain's resolved content. When .bdk/settings.json
is missing, markers expand to empty strings — the file is still emitted
so the prose-only sections reach the model.
"""

from __future__ import annotations

import argparse
import importlib.util
import re
import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = PLUGIN_ROOT / "STARTUP_INSTRUCTIONS.md"
CHAINS_DIR = PLUGIN_ROOT / "fragments" / "tool-tiers"

_MARKER_RE = re.compile(r"<!--\s*CHAIN:\s*([^\s]+)\s*-->")


def _load_inject_module():
    spec = importlib.util.spec_from_file_location(
        "inject", PLUGIN_ROOT / "scripts" / "inject.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def render(source: Path, settings: dict | None) -> str:
    """Return source content with <!-- CHAIN: ... --> markers expanded."""
    inject_mod = _load_inject_module()
    text = source.read_text(encoding="utf-8")

    def replace(match: re.Match[str]) -> str:
        chain_rel = match.group(1)
        chain_path = CHAINS_DIR / chain_rel
        if not chain_path.exists():
            print(
                f"[BDK render_startup] chain file not found: {chain_path}",
                file=sys.stderr,
            )
            return ""
        try:
            return inject_mod.inject_chain(chain_path=chain_path, settings=settings)
        except (ValueError, FileNotFoundError) as e:
            print(f"[BDK render_startup] {e}", file=sys.stderr)
            return ""

    return _MARKER_RE.sub(replace, text)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render STARTUP_INSTRUCTIONS.md with chain markers expanded"
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Path to STARTUP_INSTRUCTIONS.md (default: plugin root)",
    )
    parser.add_argument(
        "--settings",
        dest="settings_path",
        type=Path,
        help="Path to .bdk/settings.json (default: search upward from cwd)",
    )
    args = parser.parse_args()

    if not args.source.exists():
        print(
            f"[BDK render_startup] source not found: {args.source}",
            file=sys.stderr,
        )
        sys.exit(1)

    inject_mod = _load_inject_module()
    settings = inject_mod.load_settings(args.settings_path) if args.settings_path else inject_mod.load_settings()

    print(render(args.source, settings), end="")


if __name__ == "__main__":
    main()
