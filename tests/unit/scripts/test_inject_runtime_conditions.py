"""Tests for env./cmd. runtime conditions in scripts/inject.py.

Runtime conditions describe the session, not the project, so they must resolve
even with no .bdk/settings.json. The existing settings-dependent behaviour must
stay byte-identical.
"""

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
evaluate_condition = inject_mod.evaluate_condition
inject = inject_mod.inject
inject_chain = inject_mod.inject_chain
is_runtime_condition = inject_mod.is_runtime_condition


def _write_settings(tmp_path: Path, data: dict) -> Path:
    bdk = tmp_path / ".bdk"
    bdk.mkdir()
    settings = bdk / "settings.json"
    settings.write_text(json.dumps(data))
    return settings


def _run_cli(args: list[str], cwd: Path | None = None, env: dict | None = None):
    return subprocess.run(
        [sys.executable, str(SCRIPT)] + args,
        capture_output=True,
        text=True,
        cwd=str(cwd) if cwd else None,
        env={**os.environ, **(env or {})},
    )


# ---------------------------------------------------------------------------
# is_runtime_condition
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "condition",
    ["env.HERDR_ENV", "env.HERDR_ENV=1", "env.FOO=", "cmd.herdr", "cmd.python3"],
)
def test_runtime_conditions_recognised(condition):
    assert is_runtime_condition(condition) is True


@pytest.mark.parametrize(
    "condition", ["features.react", "languages[typescript]", "env.9BAD", "nonsense"]
)
def test_non_runtime_conditions_rejected(condition):
    assert is_runtime_condition(condition) is False


# ---------------------------------------------------------------------------
# evaluate_condition - env
# ---------------------------------------------------------------------------


def test_env_set_condition_true(monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    assert evaluate_condition("env.HERDR_ENV") is True


def test_env_set_condition_false_when_unset(monkeypatch):
    monkeypatch.delenv("HERDR_ENV", raising=False)
    assert evaluate_condition("env.HERDR_ENV") is False


def test_env_set_condition_false_when_empty(monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "")
    assert evaluate_condition("env.HERDR_ENV") is False


def test_env_equals_condition_matches_exactly(monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    assert evaluate_condition("env.HERDR_ENV=1") is True


def test_env_equals_condition_rejects_other_value(monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "0")
    assert evaluate_condition("env.HERDR_ENV=1") is False


def test_env_equals_condition_rejects_unset(monkeypatch):
    monkeypatch.delenv("HERDR_ENV", raising=False)
    assert evaluate_condition("env.HERDR_ENV=1") is False


def test_env_condition_ignores_settings(monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    assert evaluate_condition("env.HERDR_ENV=1", None) is True
    assert evaluate_condition("env.HERDR_ENV=1", {}) is True


# ---------------------------------------------------------------------------
# evaluate_condition - cmd
# ---------------------------------------------------------------------------


def test_cmd_condition_true_for_present_binary():
    assert evaluate_condition("cmd.python3") is True


def test_cmd_condition_false_for_absent_binary():
    assert evaluate_condition("cmd.bdk-definitely-not-a-real-binary") is False


# ---------------------------------------------------------------------------
# evaluate_condition - unknown syntax still raises
# ---------------------------------------------------------------------------


def test_unknown_condition_still_raises():
    with pytest.raises(ValueError):
        evaluate_condition("env-not-a-condition", {})


# ---------------------------------------------------------------------------
# inject() - settings-independence
# ---------------------------------------------------------------------------


def test_runtime_only_block_injects_without_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    target = tmp_path / "herdr.md"
    target.write_text("HERDR TIER")
    assert inject(["env.HERDR_ENV=1"], then_path=target, settings=None) == "HERDR TIER"


def test_runtime_only_block_suppressed_when_condition_false(tmp_path, monkeypatch):
    monkeypatch.delenv("HERDR_ENV", raising=False)
    target = tmp_path / "herdr.md"
    target.write_text("HERDR TIER")
    assert inject(["env.HERDR_ENV=1"], then_path=target, settings=None) == ""


def test_mixed_runtime_and_feature_block_needs_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    target = tmp_path / "mixed.md"
    target.write_text("MIXED")
    assert inject(["env.HERDR_ENV=1", "features.serena"], then_path=target, settings=None) == ""
    assert (
        inject(
            ["env.HERDR_ENV=1", "features.serena"],
            then_path=target,
            settings={"features": {"serena": True}},
        )
        == "MIXED"
    )


def test_feature_only_block_still_suppressed_without_settings(tmp_path):
    target = tmp_path / "f.md"
    target.write_text("FEATURE")
    assert inject(["features.serena"], then_path=target, settings=None) == ""


def test_unconditional_block_still_suppressed_without_settings(tmp_path):
    """Regression guard: empty conditions must not become settings-independent."""
    target = tmp_path / "f.md"
    target.write_text("FALLBACK")
    assert inject([], then_path=target, settings=None) == ""


def test_runtime_prefer_condition_suppresses_without_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    monkeypatch.setenv("BDK_HIGHER_TIER", "1")
    target = tmp_path / "h.md"
    target.write_text("HERDR TIER")
    result = inject(
        ["env.HERDR_ENV=1"],
        prefer_conditions=["env.BDK_HIGHER_TIER=1"],
        then_path=target,
        settings=None,
    )
    assert result == ""


# ---------------------------------------------------------------------------
# inject_chain() - the spawn chain
# ---------------------------------------------------------------------------

SPAWN_CHAIN = Path(__file__).parents[3] / "fragments" / "spawn" / "spawn.chain.json"


def _fake_herdr_on_path(tmp_path: Path, monkeypatch) -> None:
    binary = tmp_path / "herdr"
    binary.write_text("#!/bin/sh\nexit 0\n")
    binary.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path))


def test_spawn_chain_resolves_herdr_tier_without_settings(tmp_path, monkeypatch):
    monkeypatch.setenv("HERDR_ENV", "1")
    _fake_herdr_on_path(tmp_path, monkeypatch)
    result = inject_chain(SPAWN_CHAIN, settings=None)
    assert "Spawn Tier: Herdr Pane Agents" in result


def test_spawn_chain_gate_requires_herdr_env(tmp_path, monkeypatch):
    """Binary alone is not enough; we must actually be inside a Herdr pane."""
    monkeypatch.delenv("HERDR_ENV", raising=False)
    _fake_herdr_on_path(tmp_path, monkeypatch)
    assert inject_chain(SPAWN_CHAIN, settings=None) == ""


def test_spawn_chain_empty_when_not_in_herdr(monkeypatch):
    monkeypatch.delenv("HERDR_ENV", raising=False)
    assert inject_chain(SPAWN_CHAIN, settings=None) == ""
    assert inject_chain(SPAWN_CHAIN, settings={"features": {}}) == ""


def test_spawn_chain_gate_requires_herdr_binary(tmp_path, monkeypatch):
    """HERDR_ENV alone is not enough - the binary must resolve too."""
    monkeypatch.setenv("HERDR_ENV", "1")
    monkeypatch.setenv("PATH", str(tmp_path))
    assert inject_chain(SPAWN_CHAIN, settings=None) == ""


def test_existing_tier_chain_unaffected_without_settings():
    """Existing exclusive tier chains must still resolve to nothing."""
    chain = Path(__file__).parents[3] / "fragments" / "tool-tiers" / "search.chain.json"
    assert inject_chain(chain, settings=None) == ""


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def test_cli_runtime_condition_without_settings(tmp_path):
    target = tmp_path / "h.md"
    target.write_text("HERDR TIER")
    result = _run_cli(
        ["--if", "env.HERDR_ENV=1", "--then", str(target)],
        cwd=tmp_path,
        env={"HERDR_ENV": "1"},
    )
    assert result.returncode == 0
    assert result.stdout == "HERDR TIER"


def test_cli_runtime_condition_false_is_silent(tmp_path):
    target = tmp_path / "h.md"
    target.write_text("HERDR TIER")
    result = _run_cli(
        ["--if", "env.HERDR_ENV=1", "--then", str(target)],
        cwd=tmp_path,
        env={"HERDR_ENV": "0"},
    )
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_feature_condition_without_settings_still_silent(tmp_path):
    target = tmp_path / "f.md"
    target.write_text("FEATURE")
    result = _run_cli(["--if", "features.serena", "--then", str(target)], cwd=tmp_path)
    assert result.returncode == 0
    assert result.stdout == ""


def test_cli_then_text_with_settings_present(tmp_path):
    _write_settings(tmp_path, {"features": {"serena": True}})
    result = _run_cli(
        ["--if", "features.serena", "--if", "env.HERDR_ENV=1", "--then-text", "BOTH"],
        cwd=tmp_path,
        env={"HERDR_ENV": "1"},
    )
    assert result.returncode == 0
    assert result.stdout == "BOTH"
