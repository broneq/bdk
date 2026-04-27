"""Tests for scripts/inject-rules.py."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[3] / "scripts" / "inject-rules.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("inject_rules", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


inject_rules_mod = _load_module()
resolve_rule = inject_rules_mod.resolve_rule


def _write_settings(tmp_path: Path, data: dict) -> Path:
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    settings = bdk / "settings.json"
    settings.write_text(json.dumps(data))
    return settings


def _write_plugin_default(plugin_root: Path, name: str, content: str) -> Path:
    rules = plugin_root / "rules"
    rules.mkdir(parents=True, exist_ok=True)
    target = rules / f"{name}.md"
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


def test_no_settings_file_returns_bdk_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_plugin_default(plugin_root, "code-quality", "default content")
    project = tmp_path / "project"
    project.mkdir()

    result = resolve_rule("code-quality", cwd=project, plugin_root=plugin_root)

    assert result == "default content"


def test_settings_without_quality_returns_bdk_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_plugin_default(plugin_root, "code-quality", "default content")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"features": {"react": True}})

    result = resolve_rule("code-quality", cwd=project, plugin_root=plugin_root)

    assert result == "default content"


def test_settings_with_quality_but_rule_missing_returns_bdk_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_plugin_default(plugin_root, "code-quality", "default content")
    project = tmp_path / "project"
    project.mkdir()
    _write_settings(project, {"quality": {"architecture": "docs/arch.md"}})

    result = resolve_rule("code-quality", cwd=project, plugin_root=plugin_root)

    assert result == "default content"


def test_string_entry_extends_default(tmp_path):
    plugin_root = tmp_path / "plugin"
    _write_plugin_default(plugin_root, "code-quality", "default content")
    project = tmp_path / "project"
    project.mkdir()
    user_file = project / "docs" / "coding.md"
    user_file.parent.mkdir(parents=True)
    user_file.write_text("user additions")
    _write_settings(project, {"quality": {"code-quality": "docs/coding.md"}})

    result = resolve_rule("code-quality", cwd=project, plugin_root=plugin_root)

    assert result == "default content\n\nuser additions"
