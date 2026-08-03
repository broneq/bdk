#!/usr/bin/env python3
"""Enumerate rule files under a .claude/rules-style directory for /bdk:refine-rules.

Deterministic discovery step: recursively find every *.md file, parse the
`paths:` frontmatter (if present), and report size/heading stats as JSON.
Keeps this bookkeeping out of the model's context loop.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def extract_frontmatter_paths(text: str) -> list[str]:
    """Parse a `paths:` YAML list from frontmatter between leading `---` markers."""
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return []

    paths: list[str] = []
    in_paths = False
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("paths:"):
            in_paths = True
            continue
        if in_paths and line and not line[0].isspace():
            break
        if in_paths and line.strip().startswith("- "):
            pattern = line.strip().removeprefix("- ").strip().strip("\"'")
            paths.append(pattern)
    return paths


def extract_headings(text: str) -> list[str]:
    """Return every Markdown heading line (## and deeper), stripped of `#` markers."""
    headings = []
    in_frontmatter = False
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if i == 0 and line.strip() == "---":
            in_frontmatter = True
            continue
        if in_frontmatter:
            if line.strip() == "---":
                in_frontmatter = False
            continue
        stripped = line.strip()
        if stripped.startswith("#"):
            headings.append(stripped.lstrip("#").strip())
    return headings


def describe_file(path: Path, root: Path) -> dict:
    text = path.read_text(errors="replace")
    return {
        "path": str(path.relative_to(root)),
        "frontmatter_paths": extract_frontmatter_paths(text),
        "headings": extract_headings(text),
        "line_count": len(text.splitlines()),
        "char_count": len(text),
    }


def find_rule_files(rules_dir: Path) -> list[dict]:
    return [describe_file(f, rules_dir) for f in sorted(rules_dir.rglob("*.md"))]


def main() -> None:
    rules_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".claude/rules")

    if not rules_dir.is_dir():
        print(json.dumps({"rules_dir": str(rules_dir), "exists": False, "files": []}))
        return

    print(
        json.dumps(
            {
                "rules_dir": str(rules_dir),
                "exists": True,
                "files": find_rule_files(rules_dir),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
