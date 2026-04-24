"""Tests for hooks/check-bdk-config/check.py"""

from __future__ import annotations

import importlib.util
import io
import json
import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

SCRIPT = Path(__file__).parents[4] / "hooks" / "check-bdk-config" / "check.py"

FULL_SETTINGS = {
    "languages": ["typescript", "react"],
    "test-tools": [
        {"type": "vitest", "command": "npm run test:unit"},
        {"type": "playwright", "command": "npm run test:e2e"},
    ],
    "lint-tools": [{"type": "eslint", "command": "npm run lint"}],
    "build-tools": [{"type": "tsc", "command": "npm run build"}],
    "features": {"caveman": True, "serena": True, "code-review-graph": False},
}


# ---------------------------------------------------------------------------
# Module loader (avoids side effects at import time)
# ---------------------------------------------------------------------------


def _load_module():
    fake_stdin = io.StringIO(json.dumps({"session_id": "test"}))
    spec = importlib.util.spec_from_file_location("check_bdk_config", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    with patch("sys.stdin", fake_stdin), patch("sys.exit", side_effect=SystemExit):
        try:
            spec.loader.exec_module(mod)
        except SystemExit:
            pass
    return mod


# ---------------------------------------------------------------------------
# format_settings_context — pure unit tests
# ---------------------------------------------------------------------------


def test_format_includes_header():
    mod = _load_module()
    result = mod.format_settings_context(FULL_SETTINGS)
    assert "## BDK Project Settings" in result


def test_format_languages():
    mod = _load_module()
    result = mod.format_settings_context(FULL_SETTINGS)
    assert "Languages: typescript, react" in result


def test_format_test_tools():
    mod = _load_module()
    result = mod.format_settings_context(FULL_SETTINGS)
    assert "npm run test:unit (vitest)" in result
    assert "npm run test:e2e (playwright)" in result


def test_format_lint_tools():
    mod = _load_module()
    result = mod.format_settings_context(FULL_SETTINGS)
    assert "npm run lint (eslint)" in result


def test_format_build_tools():
    mod = _load_module()
    result = mod.format_settings_context(FULL_SETTINGS)
    assert "npm run build (tsc)" in result


def test_format_features_on_off():
    mod = _load_module()
    result = mod.format_settings_context(FULL_SETTINGS)
    assert "caveman=on" in result
    assert "serena=on" in result
    assert "code-review-graph=off" in result


def test_format_empty_tools_omitted():
    mod = _load_module()
    result = mod.format_settings_context({"languages": ["go"]})
    assert "Test commands" not in result
    assert "Lint commands" not in result
    assert "Build commands" not in result


def test_format_empty_features_omitted():
    mod = _load_module()
    result = mod.format_settings_context({"languages": ["go"]})
    assert "Features" not in result


def test_format_minimal_settings():
    mod = _load_module()
    result = mod.format_settings_context({})
    assert "## BDK Project Settings" in result


# ---------------------------------------------------------------------------
# Integration tests via subprocess
# ---------------------------------------------------------------------------


def _run_script(cwd: Path, stdin_data: dict | None = None) -> subprocess.CompletedProcess:  # type: ignore[type-arg]
    stdin_json = json.dumps(stdin_data or {"session_id": "test-session"})
    return subprocess.run(
        [sys.executable, str(SCRIPT)],
        capture_output=True,
        text=True,
        input=stdin_json,
        cwd=str(cwd),
        env={**os.environ},
    )


def test_missing_settings_exits_zero(tmp_path):
    result = _run_script(tmp_path)
    assert result.returncode == 0


def test_missing_settings_outputs_block_json(tmp_path):
    result = _run_script(tmp_path)
    data = json.loads(result.stdout)
    assert data["decision"] == "block"


def test_missing_settings_reason_mentions_setup(tmp_path):
    result = _run_script(tmp_path)
    data = json.loads(result.stdout)
    assert "/bdk:setup" in data["reason"]


def test_valid_settings_exits_zero(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text(json.dumps(FULL_SETTINGS))
    result = _run_script(tmp_path)
    assert result.returncode == 0


def test_valid_settings_outputs_plain_text(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text(json.dumps(FULL_SETTINGS))
    result = _run_script(tmp_path)
    assert "## BDK Project Settings" in result.stdout


def test_valid_settings_not_json_block(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text(json.dumps(FULL_SETTINGS))
    result = _run_script(tmp_path)
    # Should NOT be a JSON block decision
    try:
        data = json.loads(result.stdout)
        assert data.get("decision") != "block"
    except json.JSONDecodeError:
        pass  # plain text output — correct


def test_malformed_json_outputs_block(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text("{ invalid json }")
    result = _run_script(tmp_path)
    data = json.loads(result.stdout)
    assert data["decision"] == "block"


def test_empty_settings_file_outputs_block(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text("")
    result = _run_script(tmp_path)
    data = json.loads(result.stdout)
    assert data["decision"] == "block"


def test_empty_json_object_outputs_context(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text("{}")
    result = _run_script(tmp_path)
    assert "## BDK Project Settings" in result.stdout


def test_settings_languages_in_output(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text(json.dumps({"languages": ["go", "python"]}))
    result = _run_script(tmp_path)
    assert "go" in result.stdout
    assert "python" in result.stdout


# ---------------------------------------------------------------------------
# validate_settings — unit tests
# ---------------------------------------------------------------------------


def test_validate_valid_full_settings():
    mod = _load_module()
    assert mod.validate_settings(FULL_SETTINGS) == []


def test_validate_empty_object():
    mod = _load_module()
    assert mod.validate_settings({}) == []


def test_validate_languages_not_list():
    mod = _load_module()
    errors = mod.validate_settings({"languages": "python"})
    assert any("languages" in e for e in errors)


def test_validate_languages_non_string_items():
    mod = _load_module()
    errors = mod.validate_settings({"languages": [1, 2]})
    assert any("languages" in e for e in errors)


def test_validate_tool_array_not_list():
    mod = _load_module()
    errors = mod.validate_settings({"test-tools": "pytest"})
    assert any("test-tools" in e for e in errors)


def test_validate_tool_missing_command():
    mod = _load_module()
    errors = mod.validate_settings({"test-tools": [{"type": "direct"}]})
    assert any("command" in e for e in errors)


def test_validate_tool_command_not_string():
    mod = _load_module()
    errors = mod.validate_settings({"test-tools": [{"type": "direct", "command": 42}]})
    assert any("command" in e for e in errors)


def test_validate_features_not_dict():
    mod = _load_module()
    errors = mod.validate_settings({"features": ["caveman"]})
    assert any("features" in e for e in errors)


def test_validate_features_value_not_bool():
    mod = _load_module()
    errors = mod.validate_settings({"features": {"caveman": "yes"}})
    assert any("caveman" in e for e in errors)


def test_validate_multiple_errors():
    mod = _load_module()
    errors = mod.validate_settings({"languages": "go", "features": "bad"})
    assert len(errors) >= 2


# ---------------------------------------------------------------------------
# Integration: invalid structure blocks session
# ---------------------------------------------------------------------------


def test_invalid_structure_outputs_block(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text(json.dumps({"languages": "not-a-list"}))
    result = _run_script(tmp_path)
    data = json.loads(result.stdout)
    assert data["decision"] == "block"


def test_invalid_structure_reason_mentions_force(tmp_path):
    bdk_dir = tmp_path / ".bdk"
    bdk_dir.mkdir()
    (bdk_dir / "settings.json").write_text(json.dumps({"test-tools": "pytest"}))
    result = _run_script(tmp_path)
    data = json.loads(result.stdout)
    assert "--force" in data["reason"]
