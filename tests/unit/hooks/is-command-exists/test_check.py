"""Tests for hooks/is-command-exists/check.py"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parents[4] / "hooks" / "is-command-exists" / "check.py"


def _run(*args: str) -> subprocess.CompletedProcess:  # type: ignore[type-arg]
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        env={**os.environ},
    )


# ---------------------------------------------------------------------------
# Positive — command exists
# ---------------------------------------------------------------------------


def test_known_command_exits_zero() -> None:
    result = _run("python3")
    assert result.returncode == 0


def test_known_command_no_stderr() -> None:
    result = _run("python3")
    assert result.stderr == ""


def test_known_command_no_stdout() -> None:
    result = _run("python3")
    assert result.stdout == ""


def test_known_command_with_install_hint_exits_zero() -> None:
    result = _run("python3", "brew install python")
    assert result.returncode == 0


# ---------------------------------------------------------------------------
# Negative — command missing
# ---------------------------------------------------------------------------


def test_missing_command_exits_two() -> None:
    result = _run("__nonexistent_cmd_xyzzy__")
    assert result.returncode == 2


def test_missing_command_prints_to_stderr() -> None:
    result = _run("__nonexistent_cmd_xyzzy__")
    assert result.stderr != ""


def test_missing_command_stderr_mentions_command() -> None:
    result = _run("__nonexistent_cmd_xyzzy__")
    assert "__nonexistent_cmd_xyzzy__" in result.stderr


def test_missing_command_stderr_contains_bdk_prefix() -> None:
    result = _run("__nonexistent_cmd_xyzzy__")
    assert "[BDK]" in result.stderr


def test_missing_command_with_install_hint_includes_hint() -> None:
    result = _run("__nonexistent_cmd_xyzzy__", "brew install xyzzy")
    assert "brew install xyzzy" in result.stderr


def test_missing_command_without_hint_no_install_text() -> None:
    result = _run("__nonexistent_cmd_xyzzy__")
    assert "Install:" not in result.stderr


def test_missing_command_no_stdout() -> None:
    result = _run("__nonexistent_cmd_xyzzy__")
    assert result.stdout == ""


# ---------------------------------------------------------------------------
# Edge cases
# ---------------------------------------------------------------------------


def test_no_args_exits_zero() -> None:
    result = _run()
    assert result.returncode == 0


def test_no_args_no_output() -> None:
    result = _run()
    assert result.stderr == ""
    assert result.stdout == ""
