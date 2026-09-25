"""Tests for scripts/inject.py.

The CLI and load_settings cases run the committed dist/bdk.mjs through
scripts/kernel_settings.py, on `.bdk/settings.yaml` fixtures in a git work tree.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[3] / "scripts" / "inject.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("inject", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


inject_mod = _load_module()
load_settings = inject_mod.load_settings
evaluate_condition = inject_mod.evaluate_condition
inject = inject_mod.inject


@pytest.fixture
def project(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """A git work tree with an empty global layer."""
    root = tmp_path / "project"
    root.mkdir()
    subprocess.run(["git", "init", "--quiet"], cwd=root, check=True)
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path / "xdg"))
    return root


def _write_settings(root: Path, yaml: str) -> Path:
    settings = root / ".bdk" / "settings.yaml"
    settings.parent.mkdir(parents=True, exist_ok=True)
    settings.write_text(yaml)
    return settings


def _run_cli(args: list[str], cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT)] + args,
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env={**os.environ},
    )


# ---------------------------------------------------------------------------
# load_settings
# ---------------------------------------------------------------------------


def test_load_settings_resolves_the_yaml_layers(project):
    _write_settings(project, "features:\n  lavish: false\nlanguages: [typescript]\n")
    result = load_settings(project)
    assert result["features"] == {"lavish": False}
    assert result["languages"] == ["typescript"]


def test_load_settings_from_a_nested_directory(project):
    _write_settings(project, "languages: [typescript]\n")
    nested = project / "src" / "components"
    nested.mkdir(parents=True)
    assert load_settings(nested)["languages"] == ["typescript"]


def test_load_settings_without_a_file_is_the_defaults(project):
    result = load_settings(project)
    assert result["features"] == {"lavish": True}
    assert result["languages"] == []


def test_load_settings_raises_on_an_unknown_key(project):
    _write_settings(project, "features:\n  react: true\n")
    with pytest.raises(inject_mod.KernelSettingsError, match="features.react"):
        load_settings(project)


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
    settings = {"features": {"vue": True}}
    assert evaluate_condition("features.vue", settings) is True


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
# tool.<binary> — probes PATH, not settings
# ---------------------------------------------------------------------------


def test_evaluate_condition_tool_present(monkeypatch):
    monkeypatch.setattr(inject_mod.shutil, "which", lambda name: f"/usr/bin/{name}")
    assert evaluate_condition("tool.lavish-axi", {}) is True


def test_evaluate_condition_tool_absent(monkeypatch):
    monkeypatch.setattr(inject_mod.shutil, "which", lambda name: None)
    assert evaluate_condition("tool.lavish-axi", {}) is False


def test_evaluate_condition_tool_ignores_settings(monkeypatch):
    """The probe is about the machine, not the config.

    A `features.x` flag says the user wants the tool; `tool.x` says the tool is
    actually installed. Callers AND them, so this condition must not consult
    settings at all - reading a flag here would make a configured-but-missing
    binary look present.
    """
    monkeypatch.setattr(inject_mod.shutil, "which", lambda name: None)
    assert evaluate_condition("tool.lavish-axi", {"features": {"lavish-axi": True}}) is False


def test_evaluate_condition_tool_bracket_form_is_rejected(monkeypatch):
    """`tool[name]` must not silently work.

    _ARRAY_RE would happily parse it as a lookup in a nonexistent `tool` list
    and return False, so a typo'd condition would read as "tool absent" forever
    instead of as an error. The dotted spelling is the only accepted one, and
    the bracket form has to stay a quiet False that a lint catches - not a
    second, subtly different way to spell the same thing.
    """
    monkeypatch.setattr(inject_mod.shutil, "which", lambda name: "/usr/bin/x")
    assert evaluate_condition("tool[lavish-axi]", {}) is False


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


def test_cli_injects_file_when_condition_true(project):
    _write_settings(project, "languages: [typescript]\n")
    content_file = project / "ts.md"
    content_file.write_text("# TS guidelines")
    result = _run_cli(["--if", "languages[typescript]", "--then", str(content_file)], cwd=project)
    assert result.returncode == 0
    assert result.stdout == "# TS guidelines"
    assert result.stderr == ""


def test_cli_silent_when_feature_flag_false(project):
    _write_settings(project, "features:\n  lavish: false\n")
    result = _run_cli(["--if", "features.lavish", "--then-text", "x"], cwd=project)
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_default_applies_without_settings(project):
    """No settings file is the default layer, not "no settings": lavish defaults to true."""
    result = _run_cli(["--if", "features.lavish", "--then-text", "lavish"], cwd=project)
    assert result.returncode == 0
    assert result.stdout == "lavish"


def test_cli_and_logic_both_must_be_true(project):
    _write_settings(project, "features:\n  lavish: true\nlanguages: [python]\n")
    result = _run_cli(
        ["--if", "features.lavish", "--if", "languages[typescript]", "--then-text", "x"],
        cwd=project,
    )
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_then_text(project):
    _write_settings(project, "languages: [go]\n")
    result = _run_cli(["--if", "languages[go]", "--then-text", "Prefer tables"], cwd=project)
    assert result.returncode == 0
    assert result.stdout == "Prefer tables"


def test_cli_error_file_not_found(project):
    _write_settings(project, "languages: [go]\n")
    result = _run_cli(["--if", "languages[go]", "--then", "/nonexistent/file.md"], cwd=project)
    assert result.returncode == 0
    assert "[bdk-inject-error]" in result.stdout


def test_cli_error_invalid_condition(project):
    result = _run_cli(["--if", "bad.syntax.here", "--then-text", "x"], cwd=project)
    assert result.returncode == 0
    assert "[bdk-inject-error]" in result.stdout


def test_cli_errors_land_on_stdout_with_exit_zero(project):
    """The whole point of the marker contract, pinned.

    A `!`...`` block in a skill body captures stdout and ignores the exit code,
    so an error on stderr is invisible in the rendered skill and a nonzero exit
    changes nothing. Anything that moves these back to stderr or exit 1 silently
    turns every broken injection into an empty one.
    """
    result = _run_cli(["--if", "no-such-form", "--then-text", "x"], cwd=project)
    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout.startswith("[bdk-inject-error]")


def test_cli_kernel_refusal_is_one_error_line(project):
    _write_settings(project, "features:\n  serena: true\n")
    result = _run_cli(["--if", "features.lavish", "--then-text", "x"], cwd=project)
    assert result.returncode == 0
    assert result.stdout.startswith("[bdk-inject-error]")
    assert "features.serena" in result.stdout
    assert result.stdout.count("\n") == 1


def test_cli_settings_flag_is_gone(project):
    """`--settings` pointed at settings.json; a stale call must show, not read as false."""
    result = _run_cli(
        ["--if", "features.lavish", "--then-text", "x", "--settings", "x.json"], cwd=project
    )
    assert result.returncode == 0
    assert result.stdout.startswith("[bdk-inject-error]")


# ---------------------------------------------------------------------------
# inject with prefer_conditions
# ---------------------------------------------------------------------------

def test_inject_prefer_suppresses_when_preferred_true(tmp_path):
    """Block is suppressed when any prefer condition is true."""
    settings = {"features": {"vue": True, "react": True}}
    content_file = tmp_path / "react.md"
    content_file.write_text("# React search")
    result = inject(
        conditions=["features.react"],
        prefer_conditions=["features.vue"],
        then_path=content_file,
        settings=settings,
    )
    assert result == ""


def test_inject_prefer_passes_when_preferred_false(tmp_path):
    """Block is injected when prefer condition is false."""
    settings = {"features": {"vue": False, "react": True}}
    content_file = tmp_path / "react.md"
    content_file.write_text("# React search")
    result = inject(
        conditions=["features.react"],
        prefer_conditions=["features.vue"],
        then_path=content_file,
        settings=settings,
    )
    assert result == "# React search"


def test_inject_prefer_or_semantics_any_true_suppresses(tmp_path):
    """Multiple --prefer flags use OR — any one true suppresses."""
    settings = {"features": {"vue": False, "react": True}}
    content_file = tmp_path / "fallback.md"
    content_file.write_text("# Fallback")
    result = inject(
        conditions=[],
        prefer_conditions=["features.vue", "features.react"],
        then_path=content_file,
        settings=settings,
    )
    assert result == ""


def test_inject_prefer_empty_list_no_suppression(tmp_path):
    """Empty prefer_conditions list means no suppression."""
    settings = {"features": {"react": True}}
    content_file = tmp_path / "react.md"
    content_file.write_text("# React")
    result = inject(
        conditions=["features.react"],
        prefer_conditions=[],
        then_path=content_file,
        settings=settings,
    )
    assert result == "# React"


def test_inject_prefer_missing_settings_returns_empty(tmp_path):
    """Missing settings still returns empty regardless of prefer."""
    content_file = tmp_path / "file.md"
    content_file.write_text("content")
    result = inject(
        conditions=[],
        prefer_conditions=["features.vue"],
        then_path=content_file,
        settings=None,
    )
    assert result == ""


def test_cli_prefer_suppresses_when_preferred_true(project):
    _write_settings(project, "languages: [typescript, rust]\n")
    result = _run_cli(
        ["--if", "languages[typescript]", "--prefer", "languages[rust]", "--then-text", "ts"],
        cwd=project,
    )
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_prefer_injects_when_preferred_false(project):
    _write_settings(project, "languages: [typescript]\n")
    result = _run_cli(
        ["--if", "languages[typescript]", "--prefer", "languages[rust]", "--then-text", "ts"],
        cwd=project,
    )
    assert result.returncode == 0
    assert result.stdout == "ts"


def test_cli_prefer_multiple_or_semantics(project):
    _write_settings(project, "languages: [typescript]\n")
    result = _run_cli(
        ["--prefer", "languages[rust]", "--prefer", "languages[typescript]", "--then-text", "x"],
        cwd=project,
    )
    assert result.returncode == 0
    assert result.stdout == ""


# ---------------------------------------------------------------------------
# Argument errors follow the stdout error contract
# ---------------------------------------------------------------------------


def test_cli_unknown_flag_prints_error_on_stdout(project):
    """A `!` block captures stdout only: an argparse error on stderr with exit 2
    would render a stale call to a removed flag as an empty block."""
    result = _run_cli(["--no-such-flag", "x"], cwd=project)
    assert result.returncode == 0
    assert result.stdout.startswith("[bdk-inject-error]"), result.stdout
    assert result.stderr == ""


def test_cli_missing_then_prints_error_on_stdout(project):
    result = _run_cli(["--if", "features.lavish"], cwd=project)
    assert result.returncode == 0
    assert result.stdout.startswith("[bdk-inject-error]"), result.stdout
    assert result.stderr == ""
