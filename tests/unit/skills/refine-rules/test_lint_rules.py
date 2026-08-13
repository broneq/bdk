"""Tests for skills/refine-rules/scripts/lint_rules.py"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

SCRIPT = Path(__file__).parents[4] / "skills" / "refine-rules" / "scripts" / "lint_rules.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("lint_rules", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


CLEAN_RULE = (
    "---\npaths:\n  - src/**\n---\n\n# Clean Rules\n\n"
    "## Section\n\n- **A present-tense claim.** Because it matters.\n"
)


def _codes(findings: list[dict]) -> set[str]:
    return {f["code"] for f in findings}


# ---------------------------------------------------------------------------
# budgets
# ---------------------------------------------------------------------------


def test_clean_small_file_passes(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "clean.md"
    f.write_text(CLEAN_RULE)
    result = mod.lint_file(f)
    assert result["errors"] == []
    assert result["warnings"] == []


def test_over_line_budget_is_error(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "big.md"
    body = "\n".join(f"- **Rule {i}.** why" for i in range(200))
    f.write_text("---\npaths:\n  - a/**\n---\n\n## Critical Invariants\n\n1. x\n\n" + body)
    result = mod.lint_file(f)
    assert "budget:lines" in _codes(result["errors"])


def test_over_byte_budget_is_error(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "fat.md"
    f.write_text(
        "---\npaths:\n  - a/**\n---\n\n## Critical Invariants\n\n1. x\n\n"
        + "- **Rule.** " + "x" * 9000 + "\n"
    )
    result = mod.lint_file(f)
    assert "budget:bytes" in _codes(result["errors"])


# ---------------------------------------------------------------------------
# structure checks
# ---------------------------------------------------------------------------


def test_missing_paths_frontmatter_is_warning(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "global.md"
    f.write_text("# Global\n\n- **A claim.** why\n")
    result = mod.lint_file(f)
    assert "structure:missing-paths" in _codes(result["warnings"])
    assert result["errors"] == []


def test_missing_critical_invariants_warned_only_for_long_files(tmp_path: Path) -> None:
    mod = _load_module()
    short = tmp_path / "short.md"
    short.write_text(CLEAN_RULE)
    assert "structure:missing-critical-invariants" not in _codes(
        mod.lint_file(short)["warnings"]
    )

    long_file = tmp_path / "long.md"
    filler = "\n".join(f"- **Rule {i}.** why" for i in range(60))
    long_file.write_text("---\npaths:\n  - a/**\n---\n\n# Long\n\n" + filler + "\n")
    assert "structure:missing-critical-invariants" in _codes(
        mod.lint_file(long_file)["warnings"]
    )


def test_critical_invariants_section_satisfies_check(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "long.md"
    filler = "\n".join(f"- **Rule {i}.** why" for i in range(60))
    f.write_text(
        "---\npaths:\n  - a/**\n---\n\n# Long\n\n## Critical Invariants\n\n1. x\n\n"
        + filler
        + "\n"
    )
    assert "structure:missing-critical-invariants" not in _codes(
        mod.lint_file(f)["warnings"]
    )


# ---------------------------------------------------------------------------
# narrative markers
# ---------------------------------------------------------------------------


def test_narrative_markers_are_errors_with_line_numbers(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "story.md"
    f.write_text(
        "---\npaths:\n  - a/**\n---\n\n# Story\n\n"
        "- **A rule.** We used to validate here.\n"
        "- **Another.** An earlier attempt was reverted.\n"
    )
    result = mod.lint_file(f)
    codes = _codes(result["errors"])
    assert "narrative:used-to" in codes
    assert "narrative:earlier-attempt" in codes
    lines = {e["line"] for e in result["errors"]}
    assert lines == {8, 9}


def test_bug_id_and_numbered_invariant_are_warnings(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "ids.md"
    f.write_text(
        "---\npaths:\n  - a/**\n---\n\n# Ids\n\n"
        "- **A rule.** Closes CUR-11 (invariant I3).\n"
    )
    result = mod.lint_file(f)
    assert {"narrative:bug-id", "narrative:numbered-invariant"} <= _codes(
        result["warnings"]
    )
    assert result["errors"] == []


def test_markers_inside_code_fences_ignored(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "fenced.md"
    f.write_text(
        "---\npaths:\n  - a/**\n---\n\n# Fenced\n\n"
        "```markdown\nBad example: we used to do this previously.\n```\n"
    )
    result = mod.lint_file(f)
    assert result["errors"] == []


def test_markers_inside_frontmatter_ignored(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "fm.md"
    f.write_text("---\npaths:\n  - previously-named/**\n---\n\n# T\n\n- **R.** why\n")
    result = mod.lint_file(f)
    assert result["errors"] == []


# ---------------------------------------------------------------------------
# exemptions / collection
# ---------------------------------------------------------------------------


def test_inbox_is_exempt(tmp_path: Path) -> None:
    mod = _load_module()
    (tmp_path / "_inbox.md").write_text("we used to do X, previously Y, CUR-11\n" * 100)
    (tmp_path / "real.md").write_text(CLEAN_RULE)
    files, root = mod.collect_targets(tmp_path)
    assert [f.name for f in files] == ["real.md"]
    assert root == tmp_path


def test_collect_single_file(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "one.md"
    f.write_text(CLEAN_RULE)
    files, root = mod.collect_targets(f)
    assert files == [f]
    assert root is None


# ---------------------------------------------------------------------------
# CLI (main)
# ---------------------------------------------------------------------------


def _run_cli(*args: str, cwd: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=cwd,
    )


def test_cli_exit_zero_on_clean_dir(tmp_path: Path) -> None:
    (tmp_path / "clean.md").write_text(CLEAN_RULE)
    result = _run_cli(str(tmp_path))
    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["summary"] == {"files_checked": 1, "errors": 0, "warnings": 0}


def test_cli_exit_one_on_errors(tmp_path: Path) -> None:
    (tmp_path / "story.md").write_text(
        "---\npaths:\n  - a/**\n---\n\n- **R.** We used to do X.\n"
    )
    result = _run_cli(str(tmp_path))
    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["summary"]["errors"] == 1


def test_cli_missing_path_exits_one(tmp_path: Path) -> None:
    result = _run_cli(str(tmp_path / "nope"))
    assert result.returncode == 1
    payload = json.loads(result.stdout)
    assert payload["missing"] == [str(tmp_path / "nope")]


def test_cli_defaults_to_dot_claude_rules(tmp_path: Path) -> None:
    rules_dir = tmp_path / ".claude" / "rules"
    rules_dir.mkdir(parents=True)
    (rules_dir / "x.md").write_text(CLEAN_RULE)
    result = _run_cli(cwd=str(tmp_path))
    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["summary"]["files_checked"] == 1
