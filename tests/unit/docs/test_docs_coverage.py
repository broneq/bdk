"""Drift guard: user-invocable skills, agents, and docs pages stay indexed.

Three checks, each a regression against the source of truth in `skills/`,
`agents/`, and `docs/`:

1. Every user-invocable skill (`skills/*/SKILL.md` without
   `user-invocable: false`) must be indexed in README.md and have a
   `## /bdk:<name>` section in docs/reference/skills.md.
2. Every agent (`agents/*.md`) must be named in docs/reference/agents.md.
3. Every `.md` page under docs/ must be referenced from mkdocs.yml's `nav`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SKILLS_DIR = REPO_ROOT / "skills"
AGENTS_DIR = REPO_ROOT / "agents"
DOCS_DIR = REPO_ROOT / "docs"
README = REPO_ROOT / "README.md"
MKDOCS_YML = REPO_ROOT / "mkdocs.yml"
SKILLS_REFERENCE = DOCS_DIR / "reference" / "skills.md"
AGENTS_REFERENCE = DOCS_DIR / "reference" / "agents.md"


def _read(path: Path) -> str:
    """Return file content, or "" if the file is missing.

    A deleted or renamed index page then fails as the assertion below,
    naming the item that lost its home, instead of a bare OSError.
    """
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def _extract_frontmatter(path: Path) -> str:
    """Return the YAML frontmatter block delimited by `---` markers.

    Same regex as tests/unit/agents/test_agent_tools.py::_extract_frontmatter.
    """
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---", text, flags=re.DOTALL)
    if not match:
        raise AssertionError(f"{path}: no frontmatter delimited by --- markers")
    return match.group(1)


def _frontmatter_field(frontmatter: str, field: str) -> str | None:
    """Return a scalar frontmatter field's value, or None if absent.

    Hand-rolled line scan matching the style of
    hooks/is-skill-exist/check.py::extract_name_from_frontmatter, generalised
    to any single-line scalar field - avoids pulling in a YAML parser for a
    one-line lookup.
    """
    prefix = f"{field}:"
    for line in frontmatter.splitlines():
        if line.startswith(prefix):
            return line[len(prefix) :].strip().strip("\"'")
    return None


def _skill_name(skill_md: Path) -> str:
    """Return the skill's canonical name: frontmatter `name`, else directory name."""
    name = _frontmatter_field(_extract_frontmatter(skill_md), "name")
    return name if name else skill_md.parent.name


def _is_user_invocable(skill_md: Path) -> bool:
    value = _frontmatter_field(_extract_frontmatter(skill_md), "user-invocable")
    return value != "false"


def _agent_name(agent_md: Path) -> str:
    name = _frontmatter_field(_extract_frontmatter(agent_md), "name")
    return name if name else agent_md.stem


# ---------------------------------------------------------------------------
# Test 1 - user-invocable skills indexed in README + reference/skills.md
# ---------------------------------------------------------------------------


def _invocable_skill_paths() -> list[Path]:
    return sorted(p for p in SKILLS_DIR.glob("*/SKILL.md") if _is_user_invocable(p))


@pytest.mark.parametrize(
    "skill_md",
    _invocable_skill_paths(),
    ids=lambda p: p.parent.name,
)
def test_skill_indexed_in_readme_and_reference(skill_md: Path) -> None:
    name = _skill_name(skill_md)
    readme = _read(README)
    reference = _read(SKILLS_REFERENCE)

    missing = []
    if f"/bdk:{name}" not in readme:
        missing.append("README.md missing '/bdk:" + name + "'")
    if f"## /bdk:{name}" not in reference:
        missing.append("docs/reference/skills.md missing heading '## /bdk:" + name + "'")

    assert not missing, (
        f"skill '{name}' ({skill_md.relative_to(REPO_ROOT)}) is user-invocable "
        f"but not fully documented: {'; '.join(missing)}"
    )


# ---------------------------------------------------------------------------
# Test 2 - every agent named in docs/reference/agents.md
# ---------------------------------------------------------------------------


def _agent_paths() -> list[Path]:
    return sorted(AGENTS_DIR.glob("*.md"))


@pytest.mark.parametrize(
    "agent_md",
    _agent_paths(),
    ids=lambda p: p.stem,
)
def test_agent_documented_in_reference(agent_md: Path) -> None:
    name = _agent_name(agent_md)
    reference = _read(AGENTS_REFERENCE)

    assert name in reference, (
        f"agent '{name}' ({agent_md.relative_to(REPO_ROOT)}) is missing from "
        f"docs/reference/agents.md"
    )


# ---------------------------------------------------------------------------
# Test 3 - every docs/ page is referenced in mkdocs.yml nav
# ---------------------------------------------------------------------------

# Matches nav list entries of the form `- Title: some/path.md`, at any
# indentation depth. Deliberately not yaml.safe_load: mkdocs.yml's superfences
# config uses the `!!python/name:pymdownx.superfences.fence_code_format` tag,
# which the safe loader refuses to construct. Regex-only per plan Task 8.
NAV_ENTRY_RE = re.compile(r"^\s*-\s+[^:\n]+:\s*([^\s#]+\.md)\s*$", re.MULTILINE)


def _nav_paths() -> set[str]:
    """Return the set of `.md` paths referenced by mkdocs.yml `nav`, relative to docs/."""
    text = _read(MKDOCS_YML)
    return {match.group(1).strip().strip("\"'") for match in NAV_ENTRY_RE.finditer(text)}


def _docs_pages() -> list[Path]:
    if not DOCS_DIR.is_dir():
        return []
    return sorted(DOCS_DIR.rglob("*.md"))


@pytest.mark.parametrize(
    "page",
    _docs_pages(),
    ids=lambda p: str(p.relative_to(DOCS_DIR)),
)
def test_docs_page_referenced_in_nav(page: Path) -> None:
    relative = page.relative_to(DOCS_DIR).as_posix()
    nav_paths = _nav_paths()

    assert relative in nav_paths, (
        f"docs/{relative} is not referenced in mkdocs.yml nav "
        f"(missing-nav-file is caught by `mkdocs build --strict` too; this "
        f"test catches the opposite direction - an orphaned page nothing links to)"
    )
