"""Guard the herdr spawn-tier pointers embedded in skill bodies.

Each spawn site carries a one-paragraph `inject.py` pointer gated on the herdr
runtime conditions. A backtick anywhere inside `--then-text` silently truncates
the whole `!`...`` block when Claude Code loads the skill, so the pointer is
validated by actually executing it with the gate on and off.
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
SKILLS_DIR = ROOT / "skills"
FOUNDATION_BLOCK = "Spawn Tier: Herdr Pane Agents"

# Skill steps that dispatch agents and therefore must carry a pointer.
EXPECTED_SPAWN_SITES = {
    "subagent-execute-plan": 2,
    "cr": 1,
    "verify-plan": 1,
    "design": 1,
}

_POINTER_RE = re.compile(r"!`([^`]*inject\.py[^`]*env\.HERDR_ENV[^`]*)`")


def _pointers(skill: str) -> list[str]:
    body = (SKILLS_DIR / skill / "SKILL.md").read_text(encoding="utf-8")
    return _POINTER_RE.findall(body)


def _fake_herdr(tmp_path: Path) -> Path:
    binary = tmp_path / "herdr"
    binary.write_text("#!/bin/sh\nexit 0\n")
    binary.chmod(0o755)
    return tmp_path


def _run(command: str, env_overrides: dict) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["sh", "-c", command],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        env={**os.environ, "CLAUDE_PLUGIN_ROOT": str(ROOT), **env_overrides},
    )


ALL_SITES = [
    (skill, index)
    for skill, count in sorted(EXPECTED_SPAWN_SITES.items())
    for index in range(count)
]


@pytest.mark.parametrize("skill,expected", sorted(EXPECTED_SPAWN_SITES.items()))
def test_spawn_site_has_expected_pointer_count(skill: str, expected: int) -> None:
    found = _pointers(skill)
    assert len(found) == expected, (
        f"{skill}: expected {expected} herdr spawn pointer(s), found {len(found)}"
    )


@pytest.mark.parametrize("skill,index", ALL_SITES, ids=lambda v: str(v))
def test_pointer_renders_when_gate_passes(skill: str, index: int, tmp_path) -> None:
    command = _pointers(skill)[index]
    bindir = _fake_herdr(tmp_path)
    result = _run(command, {"HERDR_ENV": "1", "PATH": f"{bindir}:{os.environ['PATH']}"})
    assert result.returncode == 0, f"{skill}[{index}] pointer errored: {result.stderr}"
    assert result.stdout.strip(), f"{skill}[{index}] pointer produced no output"
    assert FOUNDATION_BLOCK in result.stdout, (
        f"{skill}[{index}] pointer does not cite the foundation block by name"
    )


@pytest.mark.parametrize("skill,index", ALL_SITES, ids=lambda v: str(v))
def test_pointer_silent_when_gate_fails(skill: str, index: int) -> None:
    command = _pointers(skill)[index]
    result = _run(command, {"HERDR_ENV": ""})
    assert result.returncode == 0, f"{skill}[{index}] pointer errored: {result.stderr}"
    assert result.stdout == "", (
        f"{skill}[{index}] pointer leaked herdr guidance outside a Herdr session"
    )


@pytest.mark.parametrize("skill,index", ALL_SITES, ids=lambda v: str(v))
def test_pointer_text_has_no_backticks(skill: str, index: int) -> None:
    """A backtick inside --then-text truncates the enclosing !`...` block."""
    command = _pointers(skill)[index]
    match = re.search(r"--then-text\s+'(.*)'\s*$", command, flags=re.DOTALL)
    assert match, f"{skill}[{index}]: pointer must use a single-quoted --then-text"
    assert "`" not in match.group(1), (
        f"{skill}[{index}]: backtick inside --then-text truncates the inject block"
    )


@pytest.mark.parametrize("skill,index", ALL_SITES, ids=lambda v: str(v))
def test_pointer_gates_on_both_conditions(skill: str, index: int) -> None:
    command = _pointers(skill)[index]
    assert "--if env.HERDR_ENV=1" in command, f"{skill}[{index}]: missing env gate"
    assert "--if cmd.herdr" in command, f"{skill}[{index}]: missing binary gate"
