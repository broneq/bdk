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
        {
            "type": "vitest",
            "tier": "fast",
            "command": "npm run test:unit",
            "scoped": "npx vitest run {files}",
            "related": "npx vitest related --run {files}",
            "failed": "npx vitest run --changed",
        },
        {
            "type": "playwright",
            "tier": "e2e",
            "command": "npm run test:e2e",
            "scoped": "npx playwright test {files}",
            "failed": "npx playwright test --last-failed",
        },
    ],
    "lint-tools": [
        {
            "type": "eslint",
            "tier": "lint",
            "command": "npm run lint",
            "scoped": "npx eslint {files}",
        },
        {
            "type": "tsc",
            "tier": "typecheck",
            "command": "npm run typecheck",
            "incremental": "npx tsc -b --incremental",
        },
    ],
    "build-tools": [{"type": "tsc", "command": "npm run build"}],
    "features": {"caveman": True, "serena": True, "code-review-graph": False},
}

# What a settings file written before tiers existed looks like.
LEGACY_SETTINGS = {
    "test-tools": [
        {"type": "vitest", "command": "npm run test:unit"},
        {"type": "playwright", "command": "npm run test:e2e"},
    ],
    "lint-tools": [
        {"type": "eslint", "command": "npm run lint"},
        {"type": "tsc", "command": "npm run typecheck"},
        {"type": "prettier", "command": "npm run format"},
    ],
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


def test_get_test_tools_emits_a_block_per_tier():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "test-tools")
    assert "tier=fast type=vitest" in result
    assert "tier=e2e type=playwright" in result
    # Every form is reachable, and the unscoped one is labelled by its cost.
    assert "full:" in result
    assert "npx vitest related --run {files}" in result
    assert "npx playwright test --last-failed" in result


def test_a_declared_tier_is_not_marked_as_inferred():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "test-tools")
    assert "inferred" not in result


def test_get_lint_tools_separates_lint_from_typecheck():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "lint-tools")
    assert "tier=lint type=eslint" in result
    assert "tier=typecheck type=tsc" in result
    assert "npx tsc -b --incremental" in result


def test_get_build_tools_has_no_tier():
    mod = _load_module()
    result = mod.get_value(FULL_SETTINGS, "build-tools")
    assert "type=tsc" in result
    assert "tier=" not in result
    assert "npm run build" in result


# ---------------------------------------------------------------------------
# tier inference — a settings file predating `tier` must still be usable
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "tool,expected",
    [
        ({"type": "vitest", "command": "npm run test:unit"}, "fast"),
        ({"type": "pytest", "command": "pytest"}, "fast"),
        ({"type": "playwright", "command": "npm run test:e2e"}, "e2e"),
        ({"type": "cypress", "command": "npx cypress run"}, "e2e"),
        # Named by the command alone, not the tool.
        ({"type": "vitest", "command": "npm run test:integration"}, "e2e"),
    ],
)
def test_test_tier_is_inferred_from_name_or_command(tool, expected):
    mod = _load_module()
    assert mod.infer_tier("test-tools", tool) == expected


@pytest.mark.parametrize(
    "tool,expected",
    [
        ({"type": "eslint", "command": "npm run lint"}, "lint"),
        ({"type": "tsc", "command": "npm run typecheck"}, "typecheck"),
        ({"type": "mypy", "command": "mypy ."}, "typecheck"),
        ({"type": "prettier", "command": "npm run format"}, "format"),
        ({"type": "ruff", "command": "ruff check ."}, "lint"),
    ],
)
def test_lint_tier_is_inferred_from_name_or_command(tool, expected):
    mod = _load_module()
    assert mod.infer_tier("lint-tools", tool) == expected


def test_build_tools_get_no_inferred_tier():
    mod = _load_module()
    assert mod.infer_tier("build-tools", {"type": "tsc", "command": "npm run build"}) is None


def test_an_inferred_tier_is_marked_as_a_guess():
    """A reader must be able to tell a declaration from BDK's guess."""
    mod = _load_module()
    result = mod.get_value(LEGACY_SETTINGS, "test-tools")
    assert "tier=fast type=vitest (tier inferred)" in result
    assert "tier=e2e type=playwright (tier inferred)" in result


def test_a_legacy_entry_still_yields_its_command():
    mod = _load_module()
    result = mod.get_value(LEGACY_SETTINGS, "lint-tools")
    for command in ("npm run lint", "npm run typecheck", "npm run format"):
        assert command in result


def test_an_entry_without_a_command_is_skipped():
    mod = _load_module()
    result = mod.get_value(
        {"test-tools": [{"type": "vitest"}, {"type": "pytest", "command": "pytest"}]},
        "test-tools",
    )
    assert "pytest" in result
    assert "vitest" not in result


def test_a_tool_list_with_nothing_usable_falls_back():
    """An array of junk must read as 'not configured', not as an empty block."""
    mod = _load_module()
    assert mod.get_value({"test-tools": [{"type": "vitest"}]}, "test-tools") is None


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


def test_missing_settings_exits_zero_with_fallback(tmp_path):
    result = _run(tmp_path, "languages")
    assert result.returncode == 0
    assert result.stdout.strip() != ""


def test_missing_settings_test_tools_fallback(tmp_path):
    result = _run(tmp_path, "test-tools")
    assert result.returncode == 0
    assert "test suite" in result.stdout


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
    assert "tier=fast" in result.stdout
    assert "npx vitest run {files}" in result.stdout


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


def test_missing_key_exits_zero_with_fallback(tmp_path):
    _write_settings(tmp_path, FULL_SETTINGS)
    result = _run(tmp_path, "nonexistent-key")
    assert result.returncode == 0
    assert "nonexistent-key" in result.stdout


def test_missing_tool_key_prints_generic_phrase(tmp_path):
    _write_settings(tmp_path, {})
    result = _run(tmp_path, "test-tools")
    assert result.returncode == 0
    assert "test suite" in result.stdout


def test_malformed_json_exits_one(tmp_path):
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    (bdk / "settings.json").write_text("{ bad json }")
    result = _run(tmp_path, "languages")
    assert result.returncode == 1


def test_no_stderr_on_missing_settings(tmp_path):
    result = _run(tmp_path, "languages")
    assert result.stderr == ""
