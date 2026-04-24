"""Tests for scripts/get_settings.py"""

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

SCRIPT = Path(__file__).parents[3] / "scripts" / "get_settings.py"

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
# get_value — pure unit tests
# ---------------------------------------------------------------------------


def _load_module():
    spec = importlib.util.spec_from_file_location("get_settings", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    with patch("sys.argv", ["get_settings.py", "languages"]), patch(
        "sys.exit", side_effect=SystemExit
    ):
        try:
            spec.loader.exec_module(mod)
        except SystemExit:
            pass
    return mod


def test_get_languages():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "languages")
    assert result == "typescript, react"


def test_get_test_tools():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "test-tools")
    assert "npm run test:unit (vitest)" in result
    assert "npm run test:e2e (playwright)" in result


def test_get_lint_tools():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "lint-tools")
    assert "npm run lint (eslint)" in result


def test_get_build_tools():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "build-tools")
    assert "npm run build (tsc)" in result


def test_get_features():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "features")
    assert "caveman=on" in result
    assert "code-review-graph=off" in result


def test_get_missing_key_returns_none():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "nonexistent-key")
    assert result is None


def test_get_single_language():
    mod = _load_module()
    result = mod.get_value({"languages": ["go"]}, "languages")
    assert result == "go"


def test_get_tool_without_type():
    mod = _load_module()
    result = mod.get_value({"lint-tools": [{"command": "make lint"}]}, "lint-tools")
    assert "make lint" in result


# ---------------------------------------------------------------------------
# Integration tests via subprocess
# ---------------------------------------------------------------------------


def _run(cwd: Path, *args: str) -> subprocess.CompletedProcess:  # type: ignore[type-arg]
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env={**os.environ},
    )


def _write_settings(tmp_path: Path, settings: dict) -> None:  # type: ignore[type-arg]
    bdk = tmp_path / ".bdk"
    bdk.mkdir(exist_ok=True)
    (bdk / "settings.json").write_text(json.dumps(settings))


def test_no_args_exits_one(tmp_path):
    result = _run(tmp_path)
    assert result.returncode == 1


def test_missing_settings_exits_one(tmp_path):
    result = _run(tmp_path, "languages")
    assert result.returncode == 1


def test_missing_settings_stderr_mentions_setup(tmp_path):
    result = _run(tmp_path, "languages")
    assert "/bdk:setup" in result.stderr


def test_languages_output(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "languages")
    assert result.returncode == 0
    assert "typescript" in result.stdout
    assert "react" in result.stdout


def test_test_tools_output(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "test-tools")
    assert result.returncode == 0
    assert "npm run test:unit" in result.stdout


def test_lint_tools_output(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "lint-tools")
    assert result.returncode == 0
    assert "npm run lint" in result.stdout


def test_build_tools_output(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "build-tools")
    assert result.returncode == 0
    assert "npm run build" in result.stdout


def test_features_output(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "features")
    assert result.returncode == 0
    assert "caveman=on" in result.stdout
    assert "code-review-graph=off" in result.stdout


def test_missing_key_exits_one(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "nonexistent-key")
    assert result.returncode == 1


def test_missing_key_stderr_mentions_key(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "nonexistent-key")
    assert "nonexistent-key" in result.stderr


def test_malformed_json_exits_one(tmp_path):
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    (bdk / "settings.json").write_text("{ bad json }")
    result = _run(tmp_path, "languages")
    assert result.returncode == 1


def test_no_stdout_on_error(tmp_path):
    result = _run(tmp_path, "languages")
    assert result.stdout == ""
