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


def test_render_substitutes_chain_marker(tmp_path):
    src = tmp_path / "STARTUP.md"
    src.write_text("Header.\n<!-- CHAIN: explore.chain.json -->\nFooter.\n")

    out = render(src, {"features": {}})

    assert "<!-- CHAIN:" not in out
    assert "Header." in out
    assert "Footer." in out
    assert len(out) > len("Header.\n\nFooter.\n")


def test_render_with_no_settings_still_emits_tier_text(tmp_path):
    """A project without .bdk/settings.json gets the same tier guidance:
    the tier chains are unconditional (ADR-0001)."""
    src = tmp_path / "STARTUP.md"
    src.write_text("Prose.\n<!-- CHAIN: explore.chain.json -->\nMore prose.\n")

    out = render(src, settings=None)

    assert "<!-- CHAIN:" not in out
    assert "Prose." in out
    assert "More prose." in out
    assert out == render(src, {"features": {}})


def test_render_unknown_chain_file_emits_empty_and_warns(tmp_path, capsys):
    src = tmp_path / "STARTUP.md"
    src.write_text("Before.\n<!-- CHAIN: does-not-exist.chain.json -->\nAfter.\n")

    out = render(src, settings={"features": {}})

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
    _write_settings(tmp_path, {"features": {}})
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


# ---------------------------------------------------------------------------
# Orchestrator tier guidance
# ---------------------------------------------------------------------------
#
# Subagents read tier guidance through `bdk-tier-*` preload skills (covered
# by tests/unit/fragments/test_tier_chain_render.py). The orchestrator gets
# it through this script resolving the markers in STARTUP_INSTRUCTIONS.md.

# The heading each tier fragment opens with.
TIER_HEADINGS = (
    "**Codebase Exploration",
    "**Search",
    "**Impact Analysis",
)


def _tier_sections(text: str) -> dict[str, str]:
    """Body under each tier heading, up to the next heading of any kind."""
    sections = {}
    for heading in TIER_HEADINGS:
        start = text.index(heading) + len(heading)
        rest = text[start:]
        ends = [rest.find(h) for h in (*TIER_HEADINGS, "\n## ") if rest.find(h) != -1]
        sections[heading] = rest[: min(ends)] if ends else rest
    return sections


def test_startup_tier_sections_carry_built_in_tools_text():
    out = render(PLUGIN_ROOT / "STARTUP_INSTRUCTIONS.md", {"features": {}})
    for heading, body in _tier_sections(out).items():
        assert body.strip(), f"{heading} section rendered empty"
        assert "Grep" in body or "grep" in body, f"{heading} names no search tool"
        assert "mcp__" not in body and "_tool" not in body, f"{heading} names an MCP tool"


def test_startup_render_is_independent_of_features_and_settings():
    source = PLUGIN_ROOT / "STARTUP_INSTRUCTIONS.md"
    plain = render(source, {"features": {}})
    schema = PLUGIN_ROOT / "hooks" / "check-bdk-config" / "settings.schema.json"
    declared = json.loads(schema.read_text())["properties"]["features"]["properties"]
    all_on = {"features": {**{k: True for k in declared}, "retired-server": True}}
    assert render(source, all_on) == plain
    assert render(source, None) == plain
