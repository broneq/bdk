"""Drift guard: prose never names a hook file that does not exist.

Issue #38: `skills/setup/SKILL.md` documented a
`hooks/activate-serena/activate.py` SessionStart hook, in full detail, that
was never written. Nothing failed - a plugin hook is only ever named as a
string, so a wrong path is silently inert, and the paragraph read as true for
months.

This test resolves every repo-root `hooks/...` path named in the docs, skills,
rules and hook registry against the filesystem.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]

# Files whose prose may name a hook. Globs are resolved relative to REPO_ROOT.
SCANNED_GLOBS = (
    "skills/**/*.md",
    "docs/**/*.md",
    "rules/*.md",
    "agents/*.md",
    ".claude/rules/*.md",
    "STARTUP_INSTRUCTIONS.md",
    "README.md",
    "CONTRIBUTING.md",
    "CLAUDE.md",
    "hooks/hooks.json",
)

# `hooks/<dir>` optionally followed by `/<file>`. The leading group rejects a
# match preceded by a path character, so `tests/unit/hooks/...` and
# `.claude/hooks/...` are not misread as repo-root paths - those are other
# trees, and their contents are not this test's business.
HOOK_PATH_RE = re.compile(r"(?:^|[^A-Za-z0-9_./-])(hooks/[A-Za-z0-9_<>.-]+(?:/[A-Za-z0-9_<>.-]+)?)")


def _scanned_files() -> list[Path]:
    found: set[Path] = set()
    for pattern in SCANNED_GLOBS:
        found.update(p for p in REPO_ROOT.glob(pattern) if p.is_file())
    return sorted(found)


def _referenced_paths(path: Path) -> list[tuple[int, str]]:
    """Return (line number, hook path) for each repo-root hooks/ reference.

    Placeholders such as `hooks/<hook-name>` are documentation templates, not
    claims about the filesystem, and are dropped.
    """
    text = path.read_text(encoding="utf-8")
    hits: list[tuple[int, str]] = []
    for lineno, line in enumerate(text.splitlines(), start=1):
        for match in HOOK_PATH_RE.finditer(line):
            reference = match.group(1).rstrip(".,;:)`'\"")
            if "<" in reference or ">" in reference:
                continue
            hits.append((lineno, reference))
    return hits


@pytest.mark.parametrize(
    "scanned",
    _scanned_files(),
    ids=lambda p: str(p.relative_to(REPO_ROOT)),
)
def test_referenced_hook_paths_exist(scanned: Path) -> None:
    relative = scanned.relative_to(REPO_ROOT)
    missing = [
        f"{relative}:{lineno} names '{reference}'"
        for lineno, reference in _referenced_paths(scanned)
        if not (REPO_ROOT / reference).exists()
    ]

    assert not missing, (
        "documented hook path does not exist on disk - either write the hook "
        "or stop documenting it: " + "; ".join(missing)
    )
