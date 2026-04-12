#!/usr/bin/env python3
"""Pre-flight context injection for create-fixture skill.

Reads template.html, detects format/sub-type, and emits document metadata
so the LLM knows the format constraints and edge cases available.

Use generate_ids.py to produce UUIDs and timestamps once the span count
is known.

Usage:
    uv run python .claude/skills/create-fixture/scripts/prepare_fixture.py <template.html>

Exits 0 with no output if the argument is not a valid template.html path.
Exits 0 with context output on success (never fails — graceful degradation).
"""

from __future__ import annotations

import sys
from pathlib import Path

from detection import detect_format, detect_subtype, ec6_allowed, requires_legacy_attr, user_uuid


def main() -> None:
    if len(sys.argv) < 2:
        return

    arg = sys.argv[1].strip()
    if not arg:
        return

    path = Path(arg)
    if not path.exists() or not path.is_file() or path.name != "template.html":
        return

    try:
        html = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return

    fmt = detect_format(html)
    subtype = detect_subtype(html)
    legacy = requires_legacy_attr(subtype)
    allow_ec6 = ec6_allowed(subtype)
    user = user_uuid(subtype)

    excluded_ecs = [] if allow_ec6 else ["ec6"]
    ec6_note = " (ec6 excluded — <br> additions are nype81/nype2015 only)" if not allow_ec6 else ""
    available_ecs = [f"ec{i}" for i in range(1, 11) if f"ec{i}" not in excluded_ecs]

    print("=" * 60)
    print("FIXTURE PREPARATION CONTEXT")
    print("=" * 60)
    print(f"Template:  {path}")
    print(f"Format:    {fmt}")
    print(f"Sub-type:  {subtype}")
    print(f'Legacy:    data-or-legacy-html="true" {"REQUIRED" if legacy else "NOT present"}')
    print(f"User UUID (data-user): {user}")
    print()
    print(f"Available edge cases: {' '.join(available_ecs)}{ec6_note}")
    print()
    print("=" * 60)


if __name__ == "__main__":
    main()
