"""Tests for hooks/inject/inject.py."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[4] / "hooks" / "inject" / "inject.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("inject", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


inject_mod = _load_module()
load_settings = inject_mod.load_settings
evaluate_condition = inject_mod.evaluate_condition
inject = inject_mod.inject


def _write_settings(tmp_path: Path, data: dict) -> Path:
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    settings = bdk / "settings.json"
    settings.write_text(json.dumps(data))
    return settings


def _run_cli(args: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT)] + args,
        capture_output=True,
        text=True,
        cwd=str(cwd) if cwd else None,
        env={**os.environ},
    )


# ---------------------------------------------------------------------------
# load_settings
# ---------------------------------------------------------------------------


def test_load_settings_finds_file_in_cwd(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}})
    result = load_settings(tmp_path)
    assert result == {"features": {"react": True}}


def test_load_settings_finds_file_in_parent_dir(tmp_path):
    _write_settings(tmp_path, {"languages": ["typescript"]})
    nested = tmp_path / "src" / "components"
    nested.mkdir(parents=True)
    result = load_settings(nested)
    assert result == {"languages": ["typescript"]}


def test_load_settings_returns_none_when_missing(tmp_path):
    result = load_settings(tmp_path)
    assert result is None


def test_load_settings_returns_none_on_invalid_json(tmp_path):
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    (bdk / "settings.json").write_text("not json")
    result = load_settings(tmp_path)
    assert result is None


# ---------------------------------------------------------------------------
# evaluate_condition
# ---------------------------------------------------------------------------


def test_evaluate_condition_feature_true():
    settings = {"features": {"react": True}}
    assert evaluate_condition("features.react", settings) is True


def test_evaluate_condition_feature_false():
    settings = {"features": {"react": False}}
    assert evaluate_condition("features.react", settings) is False


def test_evaluate_condition_feature_missing_key():
    settings = {"features": {}}
    assert evaluate_condition("features.react", settings) is False


def test_evaluate_condition_feature_missing_features_block():
    settings = {}
    assert evaluate_condition("features.react", settings) is False


def test_evaluate_condition_feature_hyphenated_key():
    settings = {"features": {"code-review-graph": True}}
    assert evaluate_condition("features.code-review-graph", settings) is True


def test_evaluate_condition_languages_array_hit():
    settings = {"languages": ["typescript", "react"]}
    assert evaluate_condition("languages[typescript]", settings) is True


def test_evaluate_condition_languages_array_miss():
    settings = {"languages": ["python"]}
    assert evaluate_condition("languages[typescript]", settings) is False


def test_evaluate_condition_languages_missing():
    settings = {}
    assert evaluate_condition("languages[typescript]", settings) is False


def test_evaluate_condition_invalid_syntax():
    with pytest.raises(ValueError, match="Unrecognised condition syntax"):
        evaluate_condition("bad.syntax.here", {})


def test_evaluate_condition_plain_key_invalid():
    with pytest.raises(ValueError):
        evaluate_condition("react", {})


# ---------------------------------------------------------------------------
# inject (public API)
# ---------------------------------------------------------------------------


def test_inject_all_conditions_true_returns_file_content(tmp_path):
    settings = {"features": {"react": True}}
    content_file = tmp_path / "react.md"
    content_file.write_text("# React guidelines")
    result = inject(["features.react"], then_path=content_file, settings=settings)
    assert result == "# React guidelines"


def test_inject_any_condition_false_returns_empty(tmp_path):
    settings = {"features": {"react": False}}
    content_file = tmp_path / "react.md"
    content_file.write_text("# React guidelines")
    result = inject(["features.react"], then_path=content_file, settings=settings)
    assert result == ""


def test_inject_and_logic_all_true(tmp_path):
    settings = {"features": {"react": True}, "languages": ["typescript"]}
    content_file = tmp_path / "react-ts.md"
    content_file.write_text("# React+TS")
    result = inject(
        ["features.react", "languages[typescript]"],
        then_path=content_file,
        settings=settings,
    )
    assert result == "# React+TS"


def test_inject_and_logic_one_false(tmp_path):
    settings = {"features": {"react": True}, "languages": ["python"]}
    content_file = tmp_path / "react-ts.md"
    content_file.write_text("# React+TS")
    result = inject(
        ["features.react", "languages[typescript]"],
        then_path=content_file,
        settings=settings,
    )
    assert result == ""


def test_inject_then_text():
    settings = {"features": {"react": True}}
    result = inject(["features.react"], then_text="Prefer reducers", settings=settings)
    assert result == "Prefer reducers"


def test_inject_then_text_condition_false():
    settings = {"features": {"react": False}}
    result = inject(["features.react"], then_text="Prefer reducers", settings=settings)
    assert result == ""


def test_inject_missing_settings_returns_empty(tmp_path):
    content_file = tmp_path / "react.md"
    content_file.write_text("content")
    result = inject(["features.react"], then_path=content_file, settings=None)
    assert result == ""


def test_inject_file_not_found_raises():
    settings = {"features": {"react": True}}
    with pytest.raises(FileNotFoundError):
        inject(["features.react"], then_path="/nonexistent/file.md", settings=settings)


# ---------------------------------------------------------------------------
# CLI integration
# ---------------------------------------------------------------------------


def test_cli_injects_file_when_condition_true(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}})
    content_file = tmp_path / "react.md"
    content_file.write_text("# React guidelines")
    result = _run_cli(["--if", "features.react", "--then", str(content_file)], cwd=tmp_path)
    assert result.returncode == 0
    assert result.stdout == "# React guidelines"
    assert result.stderr == ""


def test_cli_silent_when_condition_false(tmp_path):
    _write_settings(tmp_path, {"features": {"react": False}})
    content_file = tmp_path / "react.md"
    content_file.write_text("# React guidelines")
    result = _run_cli(["--if", "features.react", "--then", str(content_file)], cwd=tmp_path)
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_silent_when_settings_missing(tmp_path):
    content_file = tmp_path / "react.md"
    content_file.write_text("content")
    result = _run_cli(["--if", "features.react", "--then", str(content_file)], cwd=tmp_path)
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_and_logic_both_must_be_true(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}, "languages": ["python"]})
    content_file = tmp_path / "file.md"
    content_file.write_text("content")
    result = _run_cli(
        ["--if", "features.react", "--if", "languages[typescript]", "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_then_text(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}})
    result = _run_cli(
        ["--if", "features.react", "--then-text", "Prefer reducers"],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == "Prefer reducers"


def test_cli_error_file_not_found(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}})
    result = _run_cli(
        ["--if", "features.react", "--then", "/nonexistent/file.md"],
        cwd=tmp_path,
    )
    assert result.returncode == 1
    assert "[BDK inject]" in result.stderr


def test_cli_error_invalid_condition(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}})
    content_file = tmp_path / "file.md"
    content_file.write_text("content")
    result = _run_cli(
        ["--if", "bad.syntax.here", "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 1
    assert "[BDK inject]" in result.stderr


def test_cli_custom_settings_path(tmp_path):
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()
    _write_settings(custom_dir, {"features": {"react": True}})
    content_file = tmp_path / "react.md"
    content_file.write_text("# React")
    result = _run_cli(
        [
            "--if", "features.react",
            "--then", str(content_file),
            "--settings", str(custom_dir / ".bdk" / "settings.json"),
        ],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == "# React"
