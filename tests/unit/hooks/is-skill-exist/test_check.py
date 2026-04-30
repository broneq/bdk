"""Tests for hooks/is-skill-exist/check.py"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[4] / "hooks" / "is-skill-exist" / "check.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("check", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def _make_skill(directory: Path, name: str, extension: str = ".md") -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    skill_file = directory / f"{name}{extension}"
    skill_file.write_text(f"---\nname: {name}\n---\n\n# Skill body\n")
    return skill_file


def _run_with_dirs(skill_name: str, search_dirs: list[Path]) -> subprocess.CompletedProcess:  # type: ignore[type-arg]
    """Run check.py patching _search_dirs via a wrapper script."""
    dirs_repr = repr([str(d) for d in search_dirs])
    wrapper = f"""
import sys
sys.argv = [sys.argv[0], {skill_name!r}]
from pathlib import Path
import importlib.util
spec = importlib.util.spec_from_file_location("check", {str(SCRIPT)!r})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod._search_dirs = lambda: [Path(p) for p in {dirs_repr}]
mod.main()
"""
    import os
    return subprocess.run(
        [sys.executable, "-c", wrapper],
        capture_output=True,
        text=True,
        env={**os.environ},
    )


# ---------------------------------------------------------------------------
# extract_name_from_frontmatter (unit)
# ---------------------------------------------------------------------------


def test_extract_name_basic(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "skill.md"
    f.write_text("---\nname: caveman\ndescription: test\n---\n\nbody")
    assert mod.extract_name_from_frontmatter(f) == "caveman"


def test_extract_name_quoted(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "skill.md"
    f.write_text('---\nname: "caveman"\n---\n')
    assert mod.extract_name_from_frontmatter(f) == "caveman"


def test_extract_name_no_frontmatter(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "skill.md"
    f.write_text("# No frontmatter here\n")
    assert mod.extract_name_from_frontmatter(f) is None


def test_extract_name_missing_name_key(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "skill.md"
    f.write_text("---\ndescription: something\n---\n")
    assert mod.extract_name_from_frontmatter(f) is None


# ---------------------------------------------------------------------------
# Integration: skill found — no output
# ---------------------------------------------------------------------------


def test_skill_found_in_skills_dir_no_output(tmp_path: Path) -> None:
    skills_dir = tmp_path / "skills"
    _make_skill(skills_dir, "caveman")

    result = _run_with_dirs("caveman", [skills_dir])

    assert result.returncode == 0
    assert result.stderr == ""


def test_skill_found_in_nested_subdir(tmp_path: Path) -> None:
    """Skills can live in subdirs (e.g. skills/caveman/SKILL.md)."""
    nested = tmp_path / "skills" / "caveman"
    nested.mkdir(parents=True)
    (nested / "SKILL.md").write_text("---\nname: caveman\n---\n\nbody")

    result = _run_with_dirs("caveman", [tmp_path / "skills"])

    assert result.returncode == 0
    assert result.stderr == ""


def test_skill_found_across_multiple_dirs(tmp_path: Path) -> None:
    dir_a = tmp_path / "a"
    dir_b = tmp_path / "b"
    dir_a.mkdir()
    _make_skill(dir_b, "caveman")

    result = _run_with_dirs("caveman", [dir_a, dir_b])

    assert result.returncode == 0
    assert result.stderr == ""


def test_skill_found_as_extensionless_file(tmp_path: Path) -> None:
    """Marketplace-style skills have no extension."""
    skills_dir = tmp_path / "skills"
    _make_skill(skills_dir, "caveman-commit", extension="")

    result = _run_with_dirs("caveman-commit", [skills_dir])

    assert result.returncode == 0
    assert result.stderr == ""


# ---------------------------------------------------------------------------
# Integration: skill missing — warning printed
# ---------------------------------------------------------------------------


def test_skill_missing_prints_warning(tmp_path: Path) -> None:
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()

    result = _run_with_dirs("caveman", [skills_dir])

    assert result.returncode == 2
    assert "caveman" in result.stderr
    assert "not installed" in result.stderr


def test_skill_missing_empty_dirs(tmp_path: Path) -> None:
    result = _run_with_dirs("caveman", [tmp_path / "nonexistent"])

    assert result.returncode == 2
    assert "not installed" in result.stderr


def test_warning_mentions_install_location(tmp_path: Path) -> None:
    result = _run_with_dirs("nonexistent-skill-xyzzy", [])

    assert result.returncode == 2
    assert ".claude/skills" in result.stderr


# ---------------------------------------------------------------------------
# Integration: name mismatch — treats as missing
# ---------------------------------------------------------------------------


def test_wrong_name_in_frontmatter_warns(tmp_path: Path) -> None:
    skills_dir = tmp_path / "skills"
    _make_skill(skills_dir, "other-skill")

    result = _run_with_dirs("caveman", [skills_dir])

    assert result.returncode == 2
    assert "not installed" in result.stderr


# ---------------------------------------------------------------------------
# Marketplace discovery
# ---------------------------------------------------------------------------


def test_skill_found_in_marketplace_dir(tmp_path: Path) -> None:
    """Extensionless skill file in marketplace skills dir is detected."""
    marketplace_skills = tmp_path / ".claude" / "plugins" / "marketplaces" / "caveman" / "skills"
    _make_skill(marketplace_skills, "caveman-commit", extension="")

    result = _run_with_dirs("caveman-commit", [marketplace_skills])

    assert result.returncode == 0
    assert result.stderr == ""


# ---------------------------------------------------------------------------
# Every-turn behavior
# ---------------------------------------------------------------------------


def test_every_call_checks(tmp_path: Path) -> None:
    """Check runs on every call — no deduplication."""
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()

    first = _run_with_dirs("caveman", [skills_dir])
    second = _run_with_dirs("caveman", [skills_dir])

    assert first.returncode == 2
    assert "not installed" in first.stderr
    assert second.returncode == 2
    assert "not installed" in second.stderr


def test_different_skill_names_each_check(tmp_path: Path) -> None:
    """Different skill names → each checked independently."""
    skills_dir = tmp_path / "skills"
    skills_dir.mkdir()

    r1 = _run_with_dirs("caveman", [skills_dir])
    r2 = _run_with_dirs("other-skill", [skills_dir])

    assert "caveman" in r1.stderr
    assert "other-skill" in r2.stderr


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_no_skill_arg_exits_cleanly() -> None:
    """No argument → exit 0, no output."""
    import os
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        input=json.dumps({"session_id": "s"}),
        capture_output=True,
        text=True,
        env={**os.environ},
    )
    assert result.returncode == 0
    assert result.stderr == ""
