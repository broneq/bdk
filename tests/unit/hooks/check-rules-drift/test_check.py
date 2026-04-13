"""Tests for hooks/check-rules-drift/check.py"""

from __future__ import annotations

import importlib.util
import io
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPT = Path(__file__).parents[4] / "hooks" / "check-rules-drift" / "check.py"


def _load_module():
    """Load check.py without executing main() — stdin may be irrelevant."""
    spec = importlib.util.spec_from_file_location("check_rules_drift", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore[union-attr]
    return mod


def _run_hook(
    hook_input: dict,
    *,
    rules: dict[str, str] | None = None,
    changed_files: list[str] | None = None,
    extra_args: list[str] | None = None,
    cwd: Path | None = None,
) -> subprocess.CompletedProcess:  # type: ignore[type-arg]
    """Run check.py as subprocess with controlled environment.

    Args:
        hook_input: JSON piped to stdin.
        rules: {filename: content} written into .claude/rules/ inside cwd.
        changed_files: list returned by get_changed_files().
        extra_args: extra CLI args (e.g. ["--snapshot-baseline"]).
        cwd: working directory; defaults to a fresh tmp dir per caller.
    """
    rules = rules or {}
    changed_files = changed_files if changed_files is not None else []
    extra_args = extra_args or []

    # Patch get_changed_files via wrapper so we don't need a real git repo.
    rules_repr = json.dumps(rules)
    changed_repr = json.dumps(changed_files)
    wrapper = f"""
import sys, json, importlib.util
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("check_rules_drift", {str(SCRIPT)!r})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

sys.argv = [sys.argv[0]] + {extra_args!r}

# Write rule files
rules = json.loads({rules_repr!r})
rules_dir = Path(".claude/rules")
rules_dir.mkdir(parents=True, exist_ok=True)
for name, content in rules.items():
    (rules_dir / name).write_text(content)

with patch.object(mod, "get_changed_files", return_value=json.loads({changed_repr!r})):
    mod.main()
"""
    return subprocess.run(
        [sys.executable, "-c", wrapper],
        input=json.dumps(hook_input),
        capture_output=True,
        text=True,
        cwd=str(cwd) if cwd else None,
        env={**os.environ},
    )


def _make_rule(paths: list[str], name: str = "rule.md") -> tuple[str, str]:
    """Return (filename, content) for a rule with paths: frontmatter."""
    content = "---\npaths:\n" + "".join(f"  - {p}\n" for p in paths) + "---\n\n# Rule body\n"
    return name, content


# ---------------------------------------------------------------------------
# extract_paths_from_frontmatter (unit)
# ---------------------------------------------------------------------------


def test_extract_paths_valid_frontmatter(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "rule.md"
    f.write_text("---\npaths:\n  - src/**\n  - *.py\n---\n\nbody")
    assert mod.extract_paths_from_frontmatter(f) == ["src/**", "*.py"]


def test_extract_paths_no_frontmatter(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "rule.md"
    f.write_text("# No frontmatter\n")
    assert mod.extract_paths_from_frontmatter(f) == []


def test_extract_paths_missing_paths_key(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "rule.md"
    f.write_text("---\ntitle: something\n---\n")
    assert mod.extract_paths_from_frontmatter(f) == []


def test_extract_paths_quoted_patterns(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "rule.md"
    f.write_text('---\npaths:\n  - "src/**"\n  - \'*.txt\'\n---\n')
    assert mod.extract_paths_from_frontmatter(f) == ["src/**", "*.txt"]


def test_extract_paths_multiline(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "rule.md"
    f.write_text("---\npaths:\n  - a.txt\n  - b/c.py\n  - d/**\n---\n")
    assert mod.extract_paths_from_frontmatter(f) == ["a.txt", "b/c.py", "d/**"]


# ---------------------------------------------------------------------------
# find_matching_rules (unit)
# ---------------------------------------------------------------------------


def test_find_matching_rules_match(tmp_path: Path) -> None:
    mod = _load_module()
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "skill.md").write_text("---\npaths:\n  - skills/**\n---\n")
    result = mod.find_matching_rules(rules_dir, ["skills/foo/skill.md"])
    assert "skill.md" in result
    assert "skills/foo/skill.md" in result["skill.md"]


def test_find_matching_rules_no_match(tmp_path: Path) -> None:
    mod = _load_module()
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "skill.md").write_text("---\npaths:\n  - skills/**\n---\n")
    result = mod.find_matching_rules(rules_dir, ["hooks/something.py"])
    assert result == {}


def test_find_matching_rules_multiple_rules(tmp_path: Path) -> None:
    mod = _load_module()
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "a.md").write_text("---\npaths:\n  - *.py\n---\n")
    (rules_dir / "b.md").write_text("---\npaths:\n  - hooks/**\n---\n")
    result = mod.find_matching_rules(rules_dir, ["hooks/check.py"])
    assert "a.md" in result
    assert "b.md" in result


def test_find_matching_rules_glob_pattern(tmp_path: Path) -> None:
    mod = _load_module()
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "r.md").write_text("---\npaths:\n  - src/**\n---\n")
    result = mod.find_matching_rules(rules_dir, ["src/foo/bar/baz.py"])
    assert "r.md" in result


def test_find_matching_rules_global_rule_skipped(tmp_path: Path) -> None:
    """Rule with no paths: frontmatter is global — never triggers drift."""
    mod = _load_module()
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    (rules_dir / "global.md").write_text("# No frontmatter\n\nGlobal rule body.")
    result = mod.find_matching_rules(rules_dir, ["anything.py"])
    assert result == {}


# ---------------------------------------------------------------------------
# build_block_reason (unit)
# ---------------------------------------------------------------------------


def test_build_block_reason_format() -> None:
    mod = _load_module()
    matched = {"skill.md": ["skills/foo/check.py"]}
    reason = mod.build_block_reason(matched)
    assert "Documentation drift detected" in reason
    assert ".claude/rules/skill.md" in reason
    assert "skills/foo/check.py" in reason


def test_build_block_reason_multiple_rules() -> None:
    mod = _load_module()
    matched = {"a.md": ["file1.py"], "b.md": ["file2.py", "file3.py"]}
    reason = mod.build_block_reason(matched)
    assert ".claude/rules/a.md" in reason
    assert ".claude/rules/b.md" in reason
    assert "file1.py" in reason
    assert "file3.py" in reason


# ---------------------------------------------------------------------------
# get_file_mtimes (unit)
# ---------------------------------------------------------------------------


def test_get_file_mtimes_existing(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "a.txt"
    f.write_text("hello")
    mtimes = mod.get_file_mtimes([str(f)])
    assert str(f) in mtimes
    assert mtimes[str(f)] > 0


def test_get_file_mtimes_deleted(tmp_path: Path) -> None:
    mod = _load_module()
    missing = str(tmp_path / "gone.txt")
    mtimes = mod.get_file_mtimes([missing])
    assert mtimes[missing] == 0.0


# ---------------------------------------------------------------------------
# load_seen_state / save_seen_state (unit)
# ---------------------------------------------------------------------------


def test_save_and_load_seen_state(tmp_path: Path) -> None:
    mod = _load_module()
    with patch.object(mod, "_drift_dir", return_value=tmp_path):
        mod.save_seen_state("sess1", {"a.py": 1234.5})
        result = mod.load_seen_state("sess1")
    assert result == {"a.py": 1234.5}


def test_load_seen_state_falls_back_to_baseline(tmp_path: Path) -> None:
    mod = _load_module()
    baseline = {"b.py": 9999.0}
    baseline_file = tmp_path / "drift-baseline-sess2.json"
    baseline_file.write_text(json.dumps(baseline))

    with patch.object(mod, "_drift_dir", return_value=tmp_path):
        result = mod.load_seen_state("sess2")
    assert result == baseline


def test_load_seen_state_empty_when_nothing_exists(tmp_path: Path) -> None:
    mod = _load_module()
    with patch.object(mod, "_drift_dir", return_value=tmp_path):
        result = mod.load_seen_state("sess-unknown")
    assert result == {}


# ---------------------------------------------------------------------------
# get_changed_files (unit)
# ---------------------------------------------------------------------------


def test_get_changed_files_git_returns_files(tmp_path: Path) -> None:
    mod = _load_module()
    with patch("subprocess.run") as mock_run:
        mock_run.return_value.returncode = 0
        mock_run.return_value.stdout = "a.py\nb.py\n"
        mock_run.return_value.check = True
        # Simulate check=True success — no CalledProcessError
        import subprocess as sp
        mock_run.side_effect = None
        mock_run.return_value = sp.CompletedProcess([], 0, stdout="a.py\nb.py\n", stderr="")
        result = mod.get_changed_files()
    assert "a.py" in result
    assert "b.py" in result


def test_get_changed_files_git_fails_returns_empty() -> None:
    mod = _load_module()
    import subprocess as sp
    with patch("subprocess.run", side_effect=sp.CalledProcessError(1, "git")):
        result = mod.get_changed_files()
    assert result == []


# ---------------------------------------------------------------------------
# Scenario 1: Baseline — pre-existing dirty files ignored
# ---------------------------------------------------------------------------


def test_scenario_baseline_preexisting_dirty_ignored(tmp_path: Path) -> None:
    """Pre-existing dirty files recorded in baseline → stop hook silent."""
    rule_name, rule_content = _make_rule(["*.txt"])
    session_id = "test-session-1"

    # Write baseline: a.txt b.txt c.txt all "seen" with current mtime
    (tmp_path / "a.txt").write_text("old")
    (tmp_path / "b.txt").write_text("old")
    (tmp_path / "c.txt").write_text("old")

    drift_dir = tmp_path / "tmp" / ".rules_drift"
    drift_dir.mkdir(parents=True)
    baseline = {
        "a.txt": os.path.getmtime(tmp_path / "a.txt"),
        "b.txt": os.path.getmtime(tmp_path / "b.txt"),
        "c.txt": os.path.getmtime(tmp_path / "c.txt"),
    }
    (drift_dir / f"drift-baseline-{session_id}.json").write_text(json.dumps(baseline))

    hook_input = {"session_id": session_id}
    result = _run_hook(
        hook_input,
        rules={rule_name: rule_content},
        changed_files=["a.txt", "b.txt", "c.txt"],
        cwd=tmp_path,
    )

    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ---------------------------------------------------------------------------
# Scenario 2: AI modifies b.txt → hook fires
# ---------------------------------------------------------------------------


def test_scenario_modified_file_triggers_block(tmp_path: Path) -> None:
    """b.txt mtime changes after baseline → decision=block emitted."""
    rule_name, rule_content = _make_rule(["*.txt"])
    session_id = "test-session-2"

    (tmp_path / "b.txt").write_text("old")
    old_mtime = os.path.getmtime(tmp_path / "b.txt")

    drift_dir = tmp_path / "tmp" / ".rules_drift"
    drift_dir.mkdir(parents=True)
    baseline = {"b.txt": old_mtime}
    (drift_dir / f"drift-baseline-{session_id}.json").write_text(json.dumps(baseline))

    # Simulate mtime bump
    new_mtime = old_mtime + 10
    os.utime(tmp_path / "b.txt", (new_mtime, new_mtime))

    hook_input = {"session_id": session_id}
    result = _run_hook(
        hook_input,
        rules={rule_name: rule_content},
        changed_files=["b.txt"],
        cwd=tmp_path,
    )

    assert result.returncode == 0
    output = json.loads(result.stdout)
    assert output["decision"] == "block"
    assert "b.txt" in output["reason"]


# ---------------------------------------------------------------------------
# Scenario 3: No modification after report → silent
# ---------------------------------------------------------------------------


def test_scenario_already_reported_file_silent(tmp_path: Path) -> None:
    """b.txt mtime in seen state == current mtime → no output."""
    rule_name, rule_content = _make_rule(["*.txt"])
    session_id = "test-session-3"

    (tmp_path / "b.txt").write_text("content")
    current_mtime = os.path.getmtime(tmp_path / "b.txt")

    drift_dir = tmp_path / "tmp" / ".rules_drift"
    drift_dir.mkdir(parents=True)
    # seen state already has b.txt at current mtime (was reported last time)
    seen = {"b.txt": current_mtime}
    (drift_dir / f"drift-{session_id}.json").write_text(json.dumps(seen))

    hook_input = {"session_id": session_id}
    result = _run_hook(
        hook_input,
        rules={rule_name: rule_content},
        changed_files=["b.txt"],
        cwd=tmp_path,
    )

    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ---------------------------------------------------------------------------
# Integration: edge cases
# ---------------------------------------------------------------------------


def test_no_rules_dir_silent(tmp_path: Path) -> None:
    """No .claude/rules/ → silent."""
    result = _run_hook(
        {"session_id": "s1"},
        rules={},  # wrapper still creates rules_dir, so skip rule creation
        changed_files=["anything.py"],
        cwd=tmp_path,
    )
    # rules_dir is created by wrapper but empty → no patterns → no match → silent
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_no_changed_files_silent(tmp_path: Path) -> None:
    rule_name, rule_content = _make_rule(["*.py"])
    result = _run_hook(
        {"session_id": "s2"},
        rules={rule_name: rule_content},
        changed_files=[],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_stop_hook_active_guard(tmp_path: Path) -> None:
    """stop_hook_active=true in input → silent (infinite loop guard)."""
    rule_name, rule_content = _make_rule(["*.txt"])
    result = _run_hook(
        {"session_id": "s3", "stop_hook_active": True},
        rules={rule_name: rule_content},
        changed_files=["a.txt"],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_snapshot_baseline_mode(tmp_path: Path) -> None:
    """--snapshot-baseline writes baseline file with correct mtimes."""
    rule_name, rule_content = _make_rule(["*.txt"])
    session_id = "snap-session"

    (tmp_path / "a.txt").write_text("x")
    expected_mtime = os.path.getmtime(tmp_path / "a.txt")

    result = _run_hook(
        {"session_id": session_id},
        rules={rule_name: rule_content},
        changed_files=["a.txt"],
        extra_args=["--snapshot-baseline"],
        cwd=tmp_path,
    )

    assert result.returncode == 0
    baseline_file = tmp_path / "tmp" / ".rules_drift" / f"drift-baseline-{session_id}.json"
    assert baseline_file.exists()
    baseline = json.loads(baseline_file.read_text())
    assert "a.txt" in baseline
    assert abs(baseline["a.txt"] - expected_mtime) < 1.0


def test_changed_file_matches_rule_mtime_unchanged_silent(tmp_path: Path) -> None:
    """Changed file matches rule but mtime unchanged (already in state) → silent."""
    rule_name, rule_content = _make_rule(["*.txt"])
    session_id = "mtime-same"

    (tmp_path / "a.txt").write_text("content")
    mtime = os.path.getmtime(tmp_path / "a.txt")

    drift_dir = tmp_path / "tmp" / ".rules_drift"
    drift_dir.mkdir(parents=True)
    (drift_dir / f"drift-{session_id}.json").write_text(json.dumps({"a.txt": mtime}))

    result = _run_hook(
        {"session_id": session_id},
        rules={rule_name: rule_content},
        changed_files=["a.txt"],
        cwd=tmp_path,
    )

    assert result.returncode == 0
    assert result.stdout.strip() == ""
