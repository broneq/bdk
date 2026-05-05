"""Tests for scripts/render_startup.py."""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

PLUGIN_ROOT = Path(__file__).parents[3]
SCRIPT = PLUGIN_ROOT / "scripts" / "render_startup.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("render_startup", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


render_mod = _load_module()
render = render_mod.render


def _write_settings(tmp_path: Path, data: dict) -> Path:
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    settings_path = bdk / "settings.json"
    settings_path.write_text(json.dumps(data))
    return settings_path


def _run_cli(cwd: Path, source: Path | None = None) -> subprocess.CompletedProcess:
    args = [sys.executable, str(SCRIPT)]
    if source is not None:
        args += ["--source", str(source)]
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        cwd=str(cwd),
        env={**os.environ},
    )


# ---------------------------------------------------------------------------
# render() — direct calls
# ---------------------------------------------------------------------------


def test_render_substitutes_chain_marker_when_feature_enabled(tmp_path):
    src = tmp_path / "STARTUP.md"
    src.write_text("Header.\n<!-- CHAIN: explore.chain.json -->\nFooter.\n")
    settings = {"features": {"code-review-graph": True}}

    out = render(src, settings)

    assert "<!-- CHAIN:" not in out
    assert "Header." in out
    assert "Footer." in out
    # explore-graph fragment should have been emitted
    assert len(out) > len("Header.\n\nFooter.\n")


def test_render_with_no_settings_emits_prose_only(tmp_path):
    src = tmp_path / "STARTUP.md"
    src.write_text("Prose.\n<!-- CHAIN: explore.chain.json -->\nMore prose.\n")

    out = render(src, settings=None)

    assert "<!-- CHAIN:" not in out
    assert "Prose." in out
    assert "More prose." in out


def test_render_empty_features_emits_fallback_when_chain_has_one(tmp_path):
    src = tmp_path / "STARTUP.md"
    src.write_text("<!-- CHAIN: explore.chain.json -->\n")
    settings = {"features": {}}

    out = render(src, settings)

    # explore.chain.json is additive; with no features true, output is empty
    assert "<!-- CHAIN:" not in out


def test_render_unknown_chain_file_emits_empty_and_warns(tmp_path, capsys):
    src = tmp_path / "STARTUP.md"
    src.write_text("Before.\n<!-- CHAIN: does-not-exist.chain.json -->\nAfter.\n")

    out = render(src, settings={"features": {"code-review-graph": True}})

    assert "<!-- CHAIN:" not in out
    assert "Before." in out
    assert "After." in out
    captured = capsys.readouterr()
    assert "chain file not found" in captured.err


def test_render_preserves_text_with_no_markers(tmp_path):
    src = tmp_path / "STARTUP.md"
    body = "Just plain text.\n\nWith multiple paragraphs.\n"
    src.write_text(body)

    assert render(src, settings={"features": {}}) == body


# ---------------------------------------------------------------------------
# CLI — subprocess
# ---------------------------------------------------------------------------


def test_cli_renders_with_settings_in_cwd(tmp_path):
    _write_settings(tmp_path, {"features": {"code-review-graph": True}})
    src = tmp_path / "STARTUP.md"
    src.write_text("X\n<!-- CHAIN: search.chain.json -->\nY\n")

    result = _run_cli(cwd=tmp_path, source=src)

    assert result.returncode == 0, result.stderr
    assert "<!-- CHAIN:" not in result.stdout
    assert "X" in result.stdout
    assert "Y" in result.stdout


def test_cli_missing_settings_still_succeeds(tmp_path):
    src = tmp_path / "STARTUP.md"
    src.write_text("Hello.\n<!-- CHAIN: explore.chain.json -->\n")

    result = _run_cli(cwd=tmp_path, source=src)

    assert result.returncode == 0, result.stderr
    assert "Hello." in result.stdout
    assert "<!-- CHAIN:" not in result.stdout


def test_cli_missing_source_exits_nonzero(tmp_path):
    bogus = tmp_path / "does-not-exist.md"
    result = _run_cli(cwd=tmp_path, source=bogus)

    assert result.returncode == 1
    assert "source not found" in result.stderr
