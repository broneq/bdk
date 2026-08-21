"""Tests for scripts/inject.py."""

from __future__ import annotations

import importlib.util
import json
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
inject_chain = inject_mod.inject_chain


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
    assert result.returncode == 0
    assert "[bdk-inject-error]" in result.stdout


def test_cli_error_invalid_condition(tmp_path):
    _write_settings(tmp_path, {"features": {"react": True}})
    content_file = tmp_path / "file.md"
    content_file.write_text("content")
    result = _run_cli(
        ["--if", "bad.syntax.here", "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert "[bdk-inject-error]" in result.stdout


def test_cli_errors_land_on_stdout_with_exit_zero(tmp_path):
    """The whole point of the marker contract, pinned.

    A `!`...`` block in a skill body captures stdout and ignores the exit code,
    so an error on stderr is invisible in the rendered skill and a nonzero exit
    changes nothing. Anything that moves these back to stderr or exit 1 silently
    turns every broken injection into an empty one.
    """
    _write_settings(tmp_path, {"features": {"react": True}})
    result = _run_cli(
        ["--if", "no-such-form", "--then-text", "x"],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stderr == ""
    assert result.stdout.startswith("[bdk-inject-error]")


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


# ---------------------------------------------------------------------------
# inject with prefer_conditions
# ---------------------------------------------------------------------------

def test_inject_prefer_suppresses_when_preferred_true(tmp_path):
    """Block is suppressed when any prefer condition is true."""
    settings = {"features": {"code-review-graph": True, "serena": True}}
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena search")
    result = inject(
        conditions=["features.serena"],
        prefer_conditions=["features.code-review-graph"],
        then_path=content_file,
        settings=settings,
    )
    assert result == ""


def test_inject_prefer_passes_when_preferred_false(tmp_path):
    """Block is injected when prefer condition is false."""
    settings = {"features": {"code-review-graph": False, "serena": True}}
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena search")
    result = inject(
        conditions=["features.serena"],
        prefer_conditions=["features.code-review-graph"],
        then_path=content_file,
        settings=settings,
    )
    assert result == "# Serena search"


def test_inject_prefer_or_semantics_any_true_suppresses(tmp_path):
    """Multiple --prefer flags use OR — any one true suppresses."""
    settings = {"features": {"code-review-graph": False, "serena": True}}
    content_file = tmp_path / "fallback.md"
    content_file.write_text("# Fallback")
    result = inject(
        conditions=[],
        prefer_conditions=["features.code-review-graph", "features.serena"],
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
        prefer_conditions=["features.code-review-graph"],
        then_path=content_file,
        settings=None,
    )
    assert result == ""


def test_cli_prefer_suppresses_when_preferred_true(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": True, "serena": True}})
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena")
    result = _run_cli(
        ["--if", "features.serena", "--prefer", "features.code-review-graph",
         "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_prefer_injects_when_preferred_false(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": False, "serena": True}})
    content_file = tmp_path / "serena.md"
    content_file.write_text("# Serena")
    result = _run_cli(
        ["--if", "features.serena", "--prefer", "features.code-review-graph",
         "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == "# Serena"


def test_cli_prefer_multiple_or_semantics(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": False, "serena": True}})
    content_file = tmp_path / "fallback.md"
    content_file.write_text("# Fallback")
    result = _run_cli(
        ["--prefer", "features.code-review-graph", "--prefer", "features.serena",
         "--then", str(content_file)],
        cwd=tmp_path,
    )
    assert result.returncode == 0
    assert result.stdout == ""


def _write_chain(path, data):
    path.write_text(json.dumps(data))
    return path


# ---------------------------------------------------------------------------
# inject_chain — exclusive mode
# ---------------------------------------------------------------------------

def test_chain_exclusive_first_match_returned(tmp_path):
    """Exclusive mode returns content from first matching block only."""
    settings = {"features": {"code-review-graph": True, "serena": True}}

    graph_file = tmp_path / "search-graph.md"
    graph_file.write_text("# Graph search")
    serena_file = tmp_path / "search-serena.md"
    serena_file.write_text("# Serena search")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Graph search"


def test_chain_exclusive_skips_to_second_when_first_fails(tmp_path):
    """Exclusive mode skips to next block when first condition fails."""
    settings = {"features": {"code-review-graph": False, "serena": True}}

    graph_file = tmp_path / "search-graph.md"
    graph_file.write_text("# Graph search")
    serena_file = tmp_path / "search-serena.md"
    serena_file.write_text("# Serena search")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Serena search"


def test_chain_exclusive_unconditional_fallback(tmp_path):
    """Block with no 'if' is an unconditional fallback."""
    settings = {"features": {"code-review-graph": False, "serena": False}}

    fallback_file = tmp_path / "fallback.md"
    fallback_file.write_text("# Fallback")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(tmp_path / "graph.md")},
            {"then": str(fallback_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Fallback"


def test_chain_exclusive_no_match_returns_empty(tmp_path):
    """Exclusive mode returns empty string when no block matches."""
    settings = {"features": {"code-review-graph": False}}
    graph_file = tmp_path / "graph.md"
    graph_file.write_text("content")

    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == ""


# ---------------------------------------------------------------------------
# inject_chain — additive mode
# ---------------------------------------------------------------------------

def test_chain_additive_concatenates_all_matching(tmp_path):
    """Additive mode concatenates content from all matching blocks."""
    settings = {"features": {"code-review-graph": True, "serena": True}}

    graph_file = tmp_path / "edit-graph.md"
    graph_file.write_text("# Graph edit")
    serena_file = tmp_path / "edit-serena.md"
    serena_file.write_text("# Serena edit")

    chain_file = _write_chain(tmp_path / "edit.chain.json", {
        "mode": "additive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert "# Graph edit" in result
    assert "# Serena edit" in result


def test_chain_additive_only_matching_blocks(tmp_path):
    """Additive mode skips blocks whose conditions are false."""
    settings = {"features": {"code-review-graph": True, "serena": False}}

    graph_file = tmp_path / "edit-graph.md"
    graph_file.write_text("# Graph edit")
    serena_file = tmp_path / "edit-serena.md"
    serena_file.write_text("# Serena edit")

    chain_file = _write_chain(tmp_path / "edit.chain.json", {
        "mode": "additive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": str(graph_file)},
            {"if": ["features.serena"], "then": str(serena_file)},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert "# Graph edit" in result
    assert "# Serena edit" not in result


# ---------------------------------------------------------------------------
# inject_chain — path resolution
# ---------------------------------------------------------------------------

def test_chain_resolves_paths_relative_to_chain_file(tmp_path):
    """Paths in chain files resolve relative to chain file directory."""
    settings = {"features": {"code-review-graph": True}}

    subdir = tmp_path / "tool-tiers"
    subdir.mkdir()
    graph_file = subdir / "search-graph.md"
    graph_file.write_text("# Graph content")

    chain_file = _write_chain(subdir / "search.chain.json", {
        "mode": "exclusive",
        "chain": [
            {"if": ["features.code-review-graph"], "then": "search-graph.md"},
        ]
    })
    result = inject_chain(chain_file, settings)
    assert result == "# Graph content"


# ---------------------------------------------------------------------------
# inject_chain — CLI
# ---------------------------------------------------------------------------

def test_cli_chain_exclusive_first_match(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": True}})

    graph_file = tmp_path / "graph.md"
    graph_file.write_text("# Graph")
    chain_file = _write_chain(tmp_path / "search.chain.json", {
        "mode": "exclusive",
        "chain": [{"if": ["features.code-review-graph"], "then": str(graph_file)}],
    })

    result = _run_cli(["--chain", str(chain_file)], cwd=tmp_path)
    assert result.returncode == 0
    assert result.stdout == "# Graph"


def test_cli_chain_missing_file_reports_on_stdout(tmp_path):
    result = _run_cli(["--chain", str(tmp_path / "nonexistent.json")], cwd=tmp_path)
    assert result.returncode == 0
    assert "[bdk-inject-error]" in result.stdout
    assert result.stderr == ""


def test_chain_none_settings_returns_empty(tmp_path):
    """inject_chain returns empty string when settings is None (file exists)."""
    chain_file = _write_chain(tmp_path / "test.chain.json", {
        "mode": "exclusive",
        "chain": [{"then": str(tmp_path / "nonexistent.md")}],
    })
    result = inject_chain(chain_file, settings=None)
    assert result == ""
