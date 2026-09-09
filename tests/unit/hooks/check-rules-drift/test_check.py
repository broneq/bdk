"""Tests for hooks/check-rules-drift/check.py"""

from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from unittest.mock import patch

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


def test_build_block_reason_warns_against_trusting_prior_wording() -> None:
    mod = _load_module()
    reason = mod.build_block_reason({"skill.md": ["skills/foo/check.py"]})
    assert "Don't trust the existing wording" in reason
    assert "many different sessions and agents" in reason


def test_build_block_reason_carries_the_routing_summary() -> None:
    """The drift hook is the always-on capture path - it must state where things go."""
    mod = _load_module()
    reason = mod.build_block_reason({"skill.md": ["skills/foo/check.py"]})
    assert "a rule file" in reason
    assert "a doc comment there" in reason
    assert "one line naming the enforcer" in reason
    assert "anything else" in reason


def test_build_block_reason_legitimizes_writing_nothing() -> None:
    mod = _load_module()
    reason = mod.build_block_reason({"skill.md": ["skills/foo/check.py"]})
    assert '"Nothing" is a frequent, correct outcome' in reason
    assert "code mirror" in reason
    assert "changelog-style" in reason


def test_universal_glob_rule_is_global(tmp_path: Path) -> None:
    """paths: ** / * / **/* match everything, so the rule is global and never triggers drift."""
    mod = _load_module()
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    for i, pattern in enumerate(["**", "*", "**/*", '"**"', "./**"]):
        name, content = _make_rule([pattern], name=f"universal{i}.md")
        (rules_dir / name).write_text(content)
    name, content = _make_rule(["src/**"], name="scoped.md")
    (rules_dir / name).write_text(content)

    result = mod.find_matching_rules(rules_dir, ["src/a.py", ".claude/rules/x.md", "CLAUDE.md"])
    assert result == {"scoped.md": ["src/a.py"]}


def test_is_universal_pattern() -> None:
    mod = _load_module()
    assert mod.is_universal_pattern("**")
    assert mod.is_universal_pattern("'*'")
    assert mod.is_universal_pattern("./**/*")
    assert not mod.is_universal_pattern("src/**")
    assert not mod.is_universal_pattern("*.py")


# ---------------------------------------------------------------------------
# get_file_fingerprints (unit)
# ---------------------------------------------------------------------------


def test_get_file_fingerprints_existing(tmp_path: Path) -> None:
    mod = _load_module()
    f = tmp_path / "a.txt"
    f.write_text("hello")
    fps = mod.get_file_fingerprints([str(f)])
    assert fps == {str(f): hashlib.sha256(b"hello").hexdigest()}


def test_get_file_fingerprints_deleted(tmp_path: Path) -> None:
    mod = _load_module()
    missing = str(tmp_path / "gone.txt")
    fps = mod.get_file_fingerprints([missing])
    assert fps == {missing: mod.DELETED}


def test_get_file_fingerprints_ignore_mtime(tmp_path: Path) -> None:
    """Same bytes, different mtime → same fingerprint."""
    mod = _load_module()
    f = tmp_path / "a.txt"
    f.write_text("same")
    before = mod.get_file_fingerprints([str(f)])
    os.utime(f, (1_000_000, 1_000_000))
    after = mod.get_file_fingerprints([str(f)])
    assert before == after


# ---------------------------------------------------------------------------
# load_seen_state / save_seen_state (unit)
# ---------------------------------------------------------------------------


def test_save_and_load_seen_state(tmp_path: Path) -> None:
    mod = _load_module()
    with patch.object(mod, "_drift_dir", return_value=tmp_path):
        mod.save_seen_state("sess1", {"a.py": "abc"})
        result = mod.load_seen_state("sess1")
    assert result == {"a.py": "abc"}


def test_load_seen_state_empty_when_nothing_exists(tmp_path: Path) -> None:
    mod = _load_module()
    with patch.object(mod, "_drift_dir", return_value=tmp_path):
        result = mod.load_seen_state("sess-unknown")
    assert result == {}


def test_load_seen_state_corrupt_file_is_empty(tmp_path: Path) -> None:
    mod = _load_module()
    (tmp_path / "drift-bad.json").write_text("{not json")
    with patch.object(mod, "_drift_dir", return_value=tmp_path):
        result = mod.load_seen_state("bad")
    assert result == {}


# ---------------------------------------------------------------------------
# get_changed_files (unit)
# ---------------------------------------------------------------------------


def test_get_changed_files_git_returns_files() -> None:
    mod = _load_module()
    completed = subprocess.CompletedProcess([], 0, stdout="a.py\nb.py\n", stderr="")
    with patch("subprocess.run", return_value=completed):
        result = mod.get_changed_files()
    assert result == ["a.py", "b.py"]


def test_get_changed_files_git_fails_returns_empty() -> None:
    mod = _load_module()
    with patch("subprocess.run", side_effect=subprocess.CalledProcessError(1, "git")):
        result = mod.get_changed_files()
    assert result == []


# ---------------------------------------------------------------------------
# Multi-run scenario helpers
# ---------------------------------------------------------------------------

TXT_RULE = dict([_make_rule(["*.txt"])])


def _state_path(cwd: Path, session_id: str) -> Path:
    return cwd / ".bdk" / "tmp" / ".rules_drift" / f"drift-{session_id}.json"


def _read_state(cwd: Path, session_id: str) -> dict[str, str]:
    return json.loads(_state_path(cwd, session_id).read_text())


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _stop(
    cwd: Path,
    session_id: str,
    changed_files: list[str],
    *,
    rules: dict[str, str] | None = None,
    stop_hook_active: bool = False,
) -> dict | None:  # type: ignore[type-arg]
    """Run the Stop hook; return parsed block JSON or None when silent."""
    hook_input: dict = {"session_id": session_id}  # type: ignore[type-arg]
    if stop_hook_active:
        hook_input["stop_hook_active"] = True
    result = _run_hook(
        hook_input,
        rules=TXT_RULE if rules is None else rules,
        changed_files=changed_files,
        cwd=cwd,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout) if result.stdout.strip() else None


def _reported_files(block: dict) -> list[str]:  # type: ignore[type-arg]
    prefix = "triggered by: "
    return [
        line.strip().removeprefix(prefix)
        for line in block["reason"].splitlines()
        if line.strip().startswith(prefix)
    ]


# ---------------------------------------------------------------------------
# Scenario: incremental turns (the reported bug)
# ---------------------------------------------------------------------------


def test_scenario_incremental_turns_report_only_new_changes(tmp_path: Path) -> None:
    """Turn 1 edits a → {a}. Turn 2 edits b → {b} only. Turn 3 edits nothing → silent."""
    sid = "incremental"
    a, b = tmp_path / "a.txt", tmp_path / "b.txt"

    a.write_text("a v1")
    block = _stop(tmp_path, sid, ["a.txt"])
    assert block is not None and block["decision"] == "block"
    assert _reported_files(block) == ["a.txt"]
    assert _read_state(tmp_path, sid) == {"a.txt": _sha(a)}

    b.write_text("b v1")
    block = _stop(tmp_path, sid, ["a.txt", "b.txt"])
    assert block is not None
    assert _reported_files(block) == ["b.txt"]
    assert _read_state(tmp_path, sid) == {"a.txt": _sha(a), "b.txt": _sha(b)}

    assert _stop(tmp_path, sid, ["a.txt", "b.txt"]) is None
    assert _read_state(tmp_path, sid) == {"a.txt": _sha(a), "b.txt": _sha(b)}


def test_scenario_continuation_edit_is_absorbed(tmp_path: Path) -> None:
    """Edits made while fixing drift (stop_hook_active run) are recorded, not re-reported."""
    sid = "continuation"
    a = tmp_path / "a.txt"

    a.write_text("v1")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None

    a.write_text("v2 - touched during the blocked continuation")
    assert _stop(tmp_path, sid, ["a.txt"], stop_hook_active=True) is None
    assert _read_state(tmp_path, sid) == {"a.txt": _sha(a)}

    assert _stop(tmp_path, sid, ["a.txt"]) is None


def test_scenario_touch_without_content_change_is_silent(tmp_path: Path) -> None:
    """Formatter/codegen/checkout bumping mtime with identical bytes → not reported."""
    sid = "touch"
    a = tmp_path / "a.txt"

    a.write_text("stable")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None

    mtime = os.path.getmtime(a) + 100
    os.utime(a, (mtime, mtime))
    assert _stop(tmp_path, sid, ["a.txt"]) is None


def test_scenario_first_sight_reported_regardless_of_mtime(tmp_path: Path) -> None:
    """A file absent from state is reported even with an ancient mtime."""
    sid = "first-sight"
    a = tmp_path / "a.txt"
    a.write_text("old bytes")
    os.utime(a, (1_000_000, 1_000_000))

    block = _stop(tmp_path, sid, ["a.txt"])
    assert block is not None
    assert _reported_files(block) == ["a.txt"]


def test_scenario_revert_to_original_content_is_reported(tmp_path: Path) -> None:
    """Content differs from what was seen last run → reported, even if it equals an older version."""
    sid = "revert"
    a = tmp_path / "a.txt"

    a.write_text("original")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None
    a.write_text("edited")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None
    a.write_text("original")
    block = _stop(tmp_path, sid, ["a.txt"])
    assert block is not None
    assert _reported_files(block) == ["a.txt"]


def test_scenario_empty_diff_keeps_state(tmp_path: Path) -> None:
    """Committing everything (empty diff) must not corrupt or drop the cursor."""
    sid = "empty-diff"
    a = tmp_path / "a.txt"

    a.write_text("v1")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None
    state_before = _read_state(tmp_path, sid)

    assert _stop(tmp_path, sid, []) is None
    assert _read_state(tmp_path, sid) == state_before

    # Back in the diff with unchanged content → still silent
    assert _stop(tmp_path, sid, ["a.txt"]) is None


def test_scenario_deleted_file_reported_once(tmp_path: Path) -> None:
    sid = "deleted"
    a = tmp_path / "a.txt"

    a.write_text("v1")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None

    a.unlink()
    block = _stop(tmp_path, sid, ["a.txt"])
    assert block is not None
    assert _reported_files(block) == ["a.txt"]
    assert _read_state(tmp_path, sid) == {"a.txt": "deleted"}

    assert _stop(tmp_path, sid, ["a.txt"]) is None


def test_scenario_file_under_two_rules_reported_per_rule_stored_once(tmp_path: Path) -> None:
    sid = "two-rules"
    rules = dict([_make_rule(["*.txt"], name="one.md"), _make_rule(["a.*"], name="two.md")])
    a = tmp_path / "a.txt"
    a.write_text("v1")

    block = _stop(tmp_path, sid, ["a.txt"], rules=rules)
    assert block is not None
    assert ".claude/rules/one.md" in block["reason"]
    assert ".claude/rules/two.md" in block["reason"]
    assert _reported_files(block) == ["a.txt", "a.txt"]
    assert _read_state(tmp_path, sid) == {"a.txt": _sha(a)}

    assert _stop(tmp_path, sid, ["a.txt"], rules=rules) is None


def test_scenario_universal_rule_does_not_report_doc_edits(tmp_path: Path) -> None:
    """A `**` rule must not turn .claude/rules edits into next turn's drift trigger."""
    sid = "universal-e2e"
    rules = dict([_make_rule(["**"], name="general.md"), _make_rule(["src/**"], name="src.md")])
    (tmp_path / ".claude" / "rules").mkdir(parents=True)
    (tmp_path / ".claude" / "rules" / "x.md").write_text("doc")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "a.py").write_text("code")

    block = _stop(tmp_path, sid, [".claude/rules/x.md", "src/a.py"], rules=rules)
    assert block is not None
    assert _reported_files(block) == ["src/a.py"]
    assert "general.md" not in block["reason"]


# ---------------------------------------------------------------------------
# Scenario: --snapshot-baseline (SessionStart)
# ---------------------------------------------------------------------------


def test_snapshot_seeds_state_and_first_stop_is_silent(tmp_path: Path) -> None:
    """Files already dirty at session start are seeded into the cursor → never reported."""
    sid = "snap"
    a = tmp_path / "a.txt"
    a.write_text("pre-existing dirty")

    result = _run_hook(
        {"session_id": sid},
        rules=TXT_RULE,
        changed_files=["a.txt"],
        extra_args=["--snapshot-baseline"],
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == ""
    assert _read_state(tmp_path, sid) == {"a.txt": _sha(a)}

    assert _stop(tmp_path, sid, ["a.txt"]) is None

    # A real session edit after the snapshot is reported
    a.write_text("edited in session")
    block = _stop(tmp_path, sid, ["a.txt"])
    assert block is not None
    assert _reported_files(block) == ["a.txt"]


def test_snapshot_does_not_clobber_existing_cursor(tmp_path: Path) -> None:
    """SessionStart fires again on resume; a live cursor must survive."""
    sid = "resume"
    a = tmp_path / "a.txt"
    a.write_text("v1")
    assert _stop(tmp_path, sid, ["a.txt"]) is not None
    state_before = _read_state(tmp_path, sid)

    a.write_text("v2 - edited, then session resumed before Stop")
    result = _run_hook(
        {"session_id": sid},
        rules=TXT_RULE,
        changed_files=["a.txt"],
        extra_args=["--snapshot-baseline"],
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    assert _read_state(tmp_path, sid) == state_before

    block = _stop(tmp_path, sid, ["a.txt"])
    assert block is not None
    assert _reported_files(block) == ["a.txt"]


def test_snapshot_without_rules_dir_writes_nothing(tmp_path: Path) -> None:
    mod = _load_module()
    monkey_cwd = tmp_path / "proj"
    monkey_cwd.mkdir()
    old = os.getcwd()
    os.chdir(monkey_cwd)
    try:
        with patch.object(mod, "read_stdin_json", return_value={"session_id": "s"}), patch.object(
            mod, "get_changed_files", return_value=["a.txt"]
        ):
            mod.snapshot_baseline()
    finally:
        os.chdir(old)
    assert not _state_path(monkey_cwd, "s").exists()


def test_snapshot_removes_stale_state_files(tmp_path: Path) -> None:
    """State files untouched for >72h are removed on SessionStart; fresh ones stay."""
    drift_dir = tmp_path / ".bdk" / "tmp" / ".rules_drift"
    drift_dir.mkdir(parents=True)
    stale = drift_dir / "drift-old.json"
    fresh = drift_dir / "drift-fresh.json"
    stale.write_text("{}")
    fresh.write_text("{}")
    old_time = time.time() - (73 * 60 * 60)
    os.utime(stale, (old_time, old_time))

    result = _run_hook(
        {"session_id": "new"},
        rules=TXT_RULE,
        changed_files=[],
        extra_args=["--snapshot-baseline"],
        cwd=tmp_path,
    )
    assert result.returncode == 0, result.stderr
    assert not stale.exists()
    assert fresh.exists()


# ---------------------------------------------------------------------------
# Integration: edge cases
# ---------------------------------------------------------------------------


def test_no_rules_dir_silent(tmp_path: Path) -> None:
    """No path-scoped rules → silent, but the cursor file is still written."""
    result = _run_hook(
        {"session_id": "s1"},
        rules={},
        changed_files=["anything.py"],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert _read_state(tmp_path, "s1") == {}


def test_no_changed_files_silent(tmp_path: Path) -> None:
    assert _stop(tmp_path, "s2", []) is None


def test_stop_hook_active_guard_is_silent_but_records(tmp_path: Path) -> None:
    """stop_hook_active=true → no output (loop guard), yet the cursor advances."""
    a = tmp_path / "a.txt"
    a.write_text("v1")
    assert _stop(tmp_path, "s3", ["a.txt"], stop_hook_active=True) is None
    assert _read_state(tmp_path, "s3") == {"a.txt": _sha(a)}


def test_missing_session_id_uses_unknown(tmp_path: Path) -> None:
    a = tmp_path / "a.txt"
    a.write_text("v1")
    result = _run_hook({}, rules=TXT_RULE, changed_files=["a.txt"], cwd=tmp_path)
    assert result.returncode == 0, result.stderr
    assert _state_path(tmp_path, "unknown").exists()
