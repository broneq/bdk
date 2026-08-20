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
# admission lints - code-mirror (admission test #0)
# ---------------------------------------------------------------------------


def _warn_codes(mod, tmp_path: Path, body: str) -> set[str]:
    f = tmp_path / "rule.md"
    f.write_text("---\npaths:\n  - a/**\n---\n\n# T\n\n" + body)
    return _codes(mod.lint_file(f)["warnings"])


def test_three_paths_from_one_directory_is_warning(tmp_path: Path) -> None:
    mod = _load_module()
    body = (
        "- **Cascade order matters.** See `convex/cascade/user.ts`, "
        "`convex/cascade/org.ts`, `convex/cascade/team.ts`.\n"
    )
    assert "admission:code-mirror" in _warn_codes(mod, tmp_path, body)


def test_two_paths_from_one_directory_is_clean(tmp_path: Path) -> None:
    mod = _load_module()
    body = "- **X.** See `convex/cascade/user.ts` and `convex/cascade/org.ts`.\n"
    assert "admission:code-mirror" not in _warn_codes(mod, tmp_path, body)


def test_three_paths_across_different_directories_is_clean(tmp_path: Path) -> None:
    mod = _load_module()
    body = "- **X.** See `a/one.ts`, `b/two.ts`, `c/three.ts`.\n"
    assert "admission:code-mirror" not in _warn_codes(mod, tmp_path, body)


def test_pinning_test_citation_exempts_the_enumeration(tmp_path: Path) -> None:
    mod = _load_module()
    body = (
        "- **Layer list is exhaustive.** `a/one.ts`, `a/two.ts`, `a/three.ts` - "
        "Enforced by `a/layering.test.ts`.\n"
    )
    assert "admission:code-mirror" not in _warn_codes(mod, tmp_path, body)


def test_multi_symbol_rule_is_not_a_code_mirror(tmp_path: Path) -> None:
    """Regression guard: the canonical good example in uniform-rule-format.md."""
    mod = _load_module()
    body = (
        "- **No `ctx.db` in an `action`.** Actions have no `ctx.db`. Read via "
        "`ctx.runQuery(...)`, write via `ctx.runMutation(...)`.\n"
    )
    assert "admission:code-mirror" not in _warn_codes(mod, tmp_path, body)


def test_code_mirror_ignores_fenced_examples(tmp_path: Path) -> None:
    mod = _load_module()
    body = (
        "```markdown\n"
        "- **Bad.** `a/one.ts`, `a/two.ts`, `a/three.ts`\n"
        "```\n"
    )
    assert "admission:code-mirror" not in _warn_codes(mod, tmp_path, body)


def test_code_mirror_folds_bullet_continuation_lines(tmp_path: Path) -> None:
    mod = _load_module()
    body = (
        "- **Cascade order matters.** See `convex/cascade/user.ts`,\n"
        "  `convex/cascade/org.ts`, and `convex/cascade/team.ts` in that order.\n"
    )
    assert "admission:code-mirror" in _warn_codes(mod, tmp_path, body)


# ---------------------------------------------------------------------------
# admission lints - ticket-only rationale
# ---------------------------------------------------------------------------


def test_ticket_as_sole_rationale_is_warning(tmp_path: Path) -> None:
    mod = _load_module()
    codes = _warn_codes(mod, tmp_path, "- **Writes go through the projection.** See CUR-11.\n")
    assert "admission:ticket-only-rationale" in codes


def test_ticket_alongside_stated_consequence_is_clean(tmp_path: Path) -> None:
    mod = _load_module()
    codes = _warn_codes(
        mod,
        tmp_path,
        "- **Writes go through the projection.** A drift between the two "
        "projections loses deletions (CUR-11).\n",
    )
    assert "admission:ticket-only-rationale" not in codes
    # the broader bug-id marker still fires - the two checks are independent
    assert "narrative:bug-id" in codes


def test_bullet_without_ticket_is_clean(tmp_path: Path) -> None:
    mod = _load_module()
    codes = _warn_codes(mod, tmp_path, "- **X.** Because the two projections would diverge.\n")
    assert "admission:ticket-only-rationale" not in codes


# ---------------------------------------------------------------------------
# admission lints - severity contract
# ---------------------------------------------------------------------------


def test_admission_lints_are_warnings_and_do_not_fail_the_exit_gate(
    tmp_path: Path,
) -> None:
    (tmp_path / "mirror.md").write_text(
        "---\npaths:\n  - a/**\n---\n\n# T\n\n"
        "- **Cascade order.** `convex/cascade/user.ts`, `convex/cascade/org.ts`, "
        "`convex/cascade/team.ts`.\n"
    )
    result = _run_cli(str(tmp_path))
    payload = json.loads(result.stdout)
    assert payload["summary"]["errors"] == 0
    assert payload["summary"]["warnings"] >= 1
    assert result.returncode == 0


# ---------------------------------------------------------------------------
# iter_bullets
# ---------------------------------------------------------------------------


def test_iter_bullets_folds_continuations_and_splits_siblings() -> None:
    mod = _load_module()
    lines = (
        "---\npaths:\n  - a/**\n---\n\n# T\n\n"
        "- **First.** part one\n  part two\n"
        "- **Second.** alone\n"
    ).splitlines()
    bullets = list(mod.iter_bullets(lines))
    assert bullets == [
        (8, "- **First.** part one part two"),
        (10, "- **Second.** alone"),
    ]


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
