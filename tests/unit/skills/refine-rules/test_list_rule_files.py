"""Tests for skills/refine-rules/scripts/list_rule_files.py"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parents[4] / "skills" / "refine-rules" / "scripts" / "list_rule_files.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("list_rule_files", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


# ---------------------------------------------------------------------------
# extract_frontmatter_paths
# ---------------------------------------------------------------------------


def test_extract_frontmatter_paths_present() -> None:
    mod = _load_module()
    text = "---\npaths:\n  - src/**\n  - \"*.py\"\n---\n\n# Title\n"
    assert mod.extract_frontmatter_paths(text) == ["src/**", "*.py"]


def test_extract_frontmatter_paths_absent() -> None:
    mod = _load_module()
    assert mod.extract_frontmatter_paths("# Global rule\n\nNo frontmatter here.") == []


def test_extract_frontmatter_paths_no_paths_key() -> None:
    mod = _load_module()
    text = "---\ntitle: something\n---\n\n# Title\n"
    assert mod.extract_frontmatter_paths(text) == []


# ---------------------------------------------------------------------------
# extract_headings
# ---------------------------------------------------------------------------


def test_extract_headings_basic() -> None:
    mod = _load_module()
    text = "# Title\n\n## Section One\n\nbody\n\n### Subsection\n"
    assert mod.extract_headings(text) == ["Title", "Section One", "Subsection"]


def test_extract_headings_skips_frontmatter() -> None:
    mod = _load_module()
    text = "---\npaths:\n  - a/**\n---\n\n# Real Title\n"
    assert mod.extract_headings(text) == ["Real Title"]


def test_extract_headings_no_headings() -> None:
    mod = _load_module()
    assert mod.extract_headings("just a paragraph, no headings\n") == []


# ---------------------------------------------------------------------------
# describe_file / find_rule_files
# ---------------------------------------------------------------------------


def test_describe_file_reports_stats(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "a.md"
    f.write_text("---\npaths:\n  - src/**\n---\n\n# A\n\n## B\nsome text\nmore text\n")
    result = mod.describe_file(f, tmp_path)
    assert result["path"] == "a.md"
    assert result["frontmatter_paths"] == ["src/**"]
    assert result["headings"] == ["A", "B"]
    assert result["line_count"] > 0
    assert result["char_count"] == len(f.read_text())


def test_find_rule_files_recursive_and_sorted(tmp_path: Path) -> None:
    mod = _load_module()
    (tmp_path / "b.md").write_text("# B\n")
    nested = tmp_path / "languages"
    nested.mkdir()
    (nested / "a.md").write_text("# A\n")
    results = mod.find_rule_files(tmp_path)
    paths = [r["path"] for r in results]
    assert paths == sorted(paths)
    assert "b.md" in paths
    assert str(Path("languages") / "a.md") in paths


# ---------------------------------------------------------------------------
# CLI (main)
# ---------------------------------------------------------------------------


def test_cli_missing_rules_dir_reports_exists_false(tmp_path: Path) -> None:
    missing = tmp_path / "nope"
    result = subprocess.run(
        [sys.executable, str(SCRIPT), str(missing)],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    assert payload["exists"] is False
    assert payload["files"] == []


def test_cli_lists_files_as_json(tmp_path: Path) -> None:
    (tmp_path / "general.md").write_text("# General\n\n- **A rule.** Because reasons.\n")
    result = subprocess.run(
        [sys.executable, str(SCRIPT), str(tmp_path)],
        capture_output=True,
        text=True,
        check=True,
    )
    payload = json.loads(result.stdout)
    assert payload["exists"] is True
    assert len(payload["files"]) == 1
    assert payload["files"][0]["path"] == "general.md"


def test_cli_defaults_to_dot_claude_rules(tmp_path: Path) -> None:
    rules_dir = tmp_path / ".claude" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "x.md").write_text("# X\n")
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
        cwd=str(tmp_path),
        check=True,
    )
    payload = json.loads(result.stdout)
    assert payload["exists"] is True
    assert payload["files"][0]["path"] == "x.md"
