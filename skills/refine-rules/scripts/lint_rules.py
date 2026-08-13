#!/usr/bin/env python3
"""Mechanically lint .claude/rules-style files for /bdk:refine-rules and /bdk:add-rule.

Enforces the rule-admission contract (references/rule-admission.md):
  - file budget: max 8 KB / 150 lines           → error
  - narrative markers ("used to", bug IDs, ...) → error / warning per marker
  - `paths:` frontmatter present                → warning (global files are legitimate)
  - `## Critical Invariants` section present    → warning (only for files > 40 lines)

`_inbox.md` (the uncurated staging file) is exempt from every check.
Markers inside fenced code blocks are ignored — examples may quote bad style.

Usage:
    lint_rules.py [path ...]      # each path a rules dir or a single .md file
                                  # default: .claude/rules

Prints JSON; exits 1 when any error-severity finding exists, else 0.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

MAX_BYTES = 8192
MAX_LINES = 150
CRITICAL_INVARIANTS_MIN_LINES = 40
EXEMPT_FILENAMES = {"_inbox.md"}

# (regex, severity, code) — narrative/transition language that marks a changelog
# entry rather than a present-tense rule.
NARRATIVE_MARKERS: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(r"\bused to\b", re.I), "error", "narrative:used-to"),
    (re.compile(r"\bpreviously\b", re.I), "error", "narrative:previously"),
    (re.compile(r"\bno longer\b", re.I), "error", "narrative:no-longer"),
    (re.compile(r"\brenamed from\b", re.I), "error", "narrative:renamed-from"),
    (re.compile(r"\ban earlier attempt\b", re.I), "error", "narrative:earlier-attempt"),
    (re.compile(r"\bthis session\b", re.I), "error", "narrative:this-session"),
    (re.compile(r"\bobserved live\b", re.I), "error", "narrative:observed-live"),
    (re.compile(r"\btook a bisection\b", re.I), "error", "narrative:bisection"),
    (re.compile(r"\bwe tried\b", re.I), "error", "narrative:we-tried"),
    (re.compile(r"\bthat argument lost\b", re.I), "error", "narrative:argument-lost"),
    (re.compile(r"\b[A-Z]{2,4}-\d+\b"), "warning", "narrative:bug-id"),
    (re.compile(r"\binvariant I\d\b"), "warning", "narrative:numbered-invariant"),
]


def has_frontmatter_paths(lines: list[str]) -> bool:
    if not lines or lines[0].strip() != "---":
        return False
    for line in lines[1:]:
        if line.strip() == "---":
            return False
        if re.match(r"^paths\s*:", line.strip()):
            return True
    return False


def iter_prose_lines(lines: list[str]):
    """Yield (lineno, line) for lines outside frontmatter and fenced code blocks."""
    in_frontmatter = bool(lines) and lines[0].strip() == "---"
    in_fence = False
    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if in_frontmatter:
            if stripped == "---" and i > 1:
                in_frontmatter = False
            continue
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        yield i, line


def lint_file(path: Path, root: Path | None = None) -> dict:
    text = path.read_text(errors="replace")
    lines = text.splitlines()
    findings: list[dict] = []

    def add(severity: str, code: str, message: str, line: int | None = None) -> None:
        findings.append(
            {"severity": severity, "code": code, "message": message, "line": line}
        )

    byte_count = len(text.encode("utf-8", errors="replace"))
    if byte_count > MAX_BYTES:
        add(
            "error",
            "budget:bytes",
            f"{byte_count} bytes exceeds the {MAX_BYTES}-byte budget — compact or split by paths scope",
        )
    if len(lines) > MAX_LINES:
        add(
            "error",
            "budget:lines",
            f"{len(lines)} lines exceeds the {MAX_LINES}-line budget — compact or split by paths scope",
        )

    if not has_frontmatter_paths(lines):
        add(
            "warning",
            "structure:missing-paths",
            "no `paths:` frontmatter — every session pays for this file; scope it if possible",
        )

    if len(lines) > CRITICAL_INVARIANTS_MIN_LINES and not re.search(
        r"^##\s+Critical Invariants\s*$", text, re.M
    ):
        add(
            "warning",
            "structure:missing-critical-invariants",
            "no `## Critical Invariants` section — lead with the 3-6 constraints whose violation is data loss",
        )

    for lineno, line in iter_prose_lines(lines):
        for pattern, severity, code in NARRATIVE_MARKERS:
            match = pattern.search(line)
            if match:
                add(
                    severity,
                    code,
                    f"narrative marker {match.group(0)!r} — record the consequence, not the story",
                    lineno,
                )

    return {
        "path": str(path.relative_to(root)) if root else str(path),
        "line_count": len(lines),
        "char_count": len(text),
        "errors": [f for f in findings if f["severity"] == "error"],
        "warnings": [f for f in findings if f["severity"] == "warning"],
    }


def collect_targets(arg: Path) -> tuple[list[Path], Path | None]:
    """Return (files-to-lint, root-for-relative-paths) for one CLI argument."""
    if arg.is_file():
        return ([] if arg.name in EXEMPT_FILENAMES else [arg]), None
    if arg.is_dir():
        files = [f for f in sorted(arg.rglob("*.md")) if f.name not in EXEMPT_FILENAMES]
        return files, arg
    return [], None


def main() -> None:
    args = [Path(a) for a in sys.argv[1:]] or [Path(".claude/rules")]

    results: list[dict] = []
    missing: list[str] = []
    for arg in args:
        files, root = collect_targets(arg)
        if not files and not arg.exists():
            missing.append(str(arg))
            continue
        results.extend(lint_file(f, root) for f in files)

    error_count = sum(len(r["errors"]) for r in results)
    warning_count = sum(len(r["warnings"]) for r in results)
    print(
        json.dumps(
            {
                "missing": missing,
                "files": results,
                "summary": {
                    "files_checked": len(results),
                    "errors": error_count,
                    "warnings": warning_count,
                },
            },
            indent=2,
        )
    )
    sys.exit(1 if error_count or missing else 0)


if __name__ == "__main__":
    main()
