"""Tests for scripts/inject-language-rules.py."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[3] / "scripts" / "inject-language-rules.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("inject_language_rules", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


mod = _load_module()
resolve_language_rule = mod.resolve_language_rule
resolve_all = mod.resolve_all


def _write_settings(project: Path, data: dict) -> Path:
    bdk = project / ".bdk"
    bdk.mkdir(parents=True, exist_ok=True)
    settings = bdk / "settings.json"
    settings.write_text(json.dumps(data))
    return settings


def _write_default(plugin_root: Path, lang: str, content: str) -> Path:
    target = plugin_root / "rules" / "languages" / f"{lang}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return target


def _run_cli(args: list[str], cwd: Path, plugin_root: Path) -> subprocess.CompletedProcess:
    env = {**os.environ, "CLAUDE_PLUGIN_ROOT": str(plugin_root)}
    return subprocess.run(
        [sys.executable, str(SCRIPT)] + args,
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env=env,
    )


# ---------- resolve_language_rule ----------

def test_no_settings_returns_default_when_file_exists(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "react default")
    project = tmp_path / "project"
    project.mkdir()

    result = resolve_language_rule("react", cwd=project, plugin_root=plugin_root)

    assert result == "react default"


def test_no_default_no_override_returns_none(tmp_path):
    plugin_root = tmp_path / "plugin"
    (plugin_root / "rules" / "languages").mkdir(parents=True)
    project = tmp_path / "project"
    project.mkdir()

    result = resolve_language_rule("vue", cwd=project, plugin_root=plugin_root)

    assert result is None


def test_string_override_extends_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "default react")
    project = tmp_path / "project"
    project.mkdir()
    user_file = project / "team-react.md"
    user_file.write_text("team additions")
    _write_settings(project, {"language-rules": {"react": "team-react.md"}})

    result = resolve_language_rule("react", cwd=project, plugin_root=plugin_root)

    assert result == "default react\n\nteam additions"


def test_object_override_replace_drops_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "default react")
    project = tmp_path / "project"
    project.mkdir()
    user_file = project / "custom.md"
    user_file.write_text("custom only")
    _write_settings(
        project,
        {"language-rules": {"react": {"path": "custom.md", "mode": "replace"}}},
    )

    result = resolve_language_rule("react", cwd=project, plugin_root=plugin_root)

    assert result == "custom only"


def test_override_replace_works_without_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    (plugin_root / "rules" / "languages").mkdir(parents=True)
    project = tmp_path / "project"
    project.mkdir()
    user_file = project / "svelte.md"
    user_file.write_text("svelte rules")
    _write_settings(
        project,
        {"language-rules": {"svelte": {"path": "svelte.md", "mode": "replace"}}},
    )

    result = resolve_language_rule("svelte", cwd=project, plugin_root=plugin_root)

    assert result == "svelte rules"


def test_override_extends_works_without_default(tmp_path):
    """extends-mode override survives a missing default — falls through to user content."""
    plugin_root = tmp_path / "plugin"
    (plugin_root / "rules" / "languages").mkdir(parents=True)
    project = tmp_path / "project"
    project.mkdir()
    user_file = project / "svelte.md"
    user_file.write_text("svelte user rules")
    _write_settings(project, {"language-rules": {"svelte": "svelte.md"}})

    result = resolve_language_rule("svelte", cwd=project, plugin_root=plugin_root)

    assert result == "svelte user rules"


def test_user_file_missing_raises(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "default")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"language-rules": {"react": "missing.md"}})

    with pytest.raises(FileNotFoundError):
        resolve_language_rule("react", cwd=project, plugin_root=plugin_root)


def test_object_override_missing_path_raises(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "default")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(
        project,
        {"language-rules": {"react": {"mode": "replace"}}},
    )

    with pytest.raises(ValueError, match="path.*required"):
        resolve_language_rule("react", cwd=project, plugin_root=plugin_root)


def test_unknown_mode_warns_and_extends(tmp_path, capsys):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "default")
    project = tmp_path / "project"
    project.mkdir()
    user_file = project / "user.md"
    user_file.write_text("user")
    _write_settings(
        project,
        {"language-rules": {"react": {"path": "user.md", "mode": "wat"}}},
    )

    result = resolve_language_rule("react", cwd=project, plugin_root=plugin_root)

    assert result == "default\n\nuser"
    captured = capsys.readouterr()
    assert "[bdk-inject-error]" in captured.out
    assert "unknown mode" in captured.out
    assert captured.err == ""


# ---------- resolve_all ----------

def test_resolve_all_no_settings_returns_empty(tmp_path):
    plugin_root = tmp_path / "plugin"
    project = tmp_path / "project"
    project.mkdir()

    assert resolve_all(cwd=project, plugin_root=plugin_root) == ""


def test_resolve_all_no_languages_key_returns_empty(tmp_path):
    plugin_root = tmp_path / "plugin"
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"features": {"react": True}})

    assert resolve_all(cwd=project, plugin_root=plugin_root) == ""


def test_resolve_all_empty_languages_returns_empty(tmp_path):
    plugin_root = tmp_path / "plugin"
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"languages": []})

    assert resolve_all(cwd=project, plugin_root=plugin_root) == ""


def test_resolve_all_skips_languages_without_rules(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "react rules")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"languages": ["react", "vue"]})

    result = resolve_all(cwd=project, plugin_root=plugin_root)

    assert result == "react rules"


def test_resolve_all_concatenates_multiple_languages(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "react rules")
    _write_default(plugin_root, "typescript", "ts rules")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"languages": ["react", "typescript"]})

    result = resolve_all(cwd=project, plugin_root=plugin_root)

    assert result == "react rules\n\nts rules"


def test_resolve_all_ignores_non_string_language_entries(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "react rules")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"languages": ["react", 42, None]})

    result = resolve_all(cwd=project, plugin_root=plugin_root)

    assert result == "react rules"


# ---------- CLI ----------

def test_cli_no_args_emits_all_to_stdout(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "react rules")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"languages": ["react"]})

    proc = _run_cli([], cwd=project, plugin_root=plugin_root)

    assert proc.returncode == 0, proc.stderr
    assert proc.stdout == "react rules"


def test_cli_lang_arg_emits_one_language(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "react rules")
    _write_default(plugin_root, "typescript", "ts rules")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"languages": ["react", "typescript"]})

    proc = _run_cli(["react"], cwd=project, plugin_root=plugin_root)

    assert proc.returncode == 0
    assert proc.stdout == "react rules"


def test_cli_no_settings_silent_exit_zero(tmp_path):
    plugin_root = tmp_path / "plugin"
    (plugin_root / "rules" / "languages").mkdir(parents=True)
    project = tmp_path / "project"
    project.mkdir()

    proc = _run_cli([], cwd=project, plugin_root=plugin_root)

    assert proc.returncode == 0
    assert proc.stdout == ""


def test_cli_missing_user_file_reports_on_stdout(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_default(plugin_root, "react", "default")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(
        project,
        {"languages": ["react"], "language-rules": {"react": "missing.md"}},
    )

    proc = _run_cli([], cwd=project, plugin_root=plugin_root)

    assert proc.returncode == 0
    assert "[bdk-inject-error]" in proc.stdout
    assert "user file not found" in proc.stdout
    assert proc.stderr == ""


def test_cli_too_many_args_reports_on_stdout(tmp_path):
    plugin_root = tmp_path / "plugin"
    project = tmp_path / "project"
    project.mkdir()

    proc = _run_cli(["a", "b"], cwd=project, plugin_root=plugin_root)

    assert proc.returncode == 0
    assert "[bdk-inject-error]" in proc.stdout
    assert proc.stderr == ""
