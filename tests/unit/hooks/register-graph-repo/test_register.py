"""Tests for hooks/register-graph-repo/register.py."""

from __future__ import annotations

import importlib.util
import io
import json
import subprocess
from pathlib import Path
from unittest.mock import patch

REPO_ROOT = Path(__file__).resolve().parents[4]
SCRIPT_PATH = REPO_ROOT / "hooks" / "register-graph-repo" / "register.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("register_graph_repo", SCRIPT_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


register = _load_module()


def _write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload))


def _run_main(cwd: Path, *, uvx: str | None = "/usr/bin/uvx",
               run_result: subprocess.CompletedProcess | None = None,
               run_exc: Exception | None = None,
               status_result: subprocess.CompletedProcess | None = None,
               ) -> tuple[str, list]:
    """Invoke main() with cwd, uvx availability, and subprocess.run patched.

    `run_result` / `run_exc` apply to the register call, `status_result` to
    the status call. Returns (stdout, captured_run_calls).
    """
    fake_stdin = io.StringIO("")
    captured = io.StringIO()
    calls: list = []

    def fake_run(*args, **kwargs):
        calls.append((args, kwargs))
        cmd = args[0] if args else kwargs.get("args", [])
        if "status" in cmd:
            return status_result or subprocess.CompletedProcess(
                args=cmd, returncode=0, stdout="", stderr=""
            )
        if run_exc is not None:
            raise run_exc
        return run_result or subprocess.CompletedProcess(
            args=args[0] if args else [], returncode=0, stdout="", stderr=""
        )

    with patch("os.getcwd", return_value=str(cwd)), \
         patch("sys.stdin", fake_stdin), \
         patch("sys.stdout", captured), \
         patch("sys.exit", side_effect=SystemExit), \
         patch("shutil.which", return_value=uvx), \
         patch("subprocess.run", side_effect=fake_run):
        try:
            register.main()
        except SystemExit:
            pass
    return captured.getvalue(), calls


# ---- _graph_enabled ----

def test_enabled_when_features_missing():
    assert register._graph_enabled({}) is True


def test_enabled_when_feature_true():
    assert register._graph_enabled({"features": {"code-review-graph": True}}) is True


def test_disabled_when_feature_false():
    assert register._graph_enabled({"features": {"code-review-graph": False}}) is False


def test_enabled_when_feature_omitted():
    assert register._graph_enabled({"features": {"serena": True}}) is True


def test_enabled_when_features_not_dict():
    assert register._graph_enabled({"features": "garbage"}) is True


# ---- main() integration ----

def test_silent_when_settings_missing(tmp_path: Path):
    out, calls = _run_main(tmp_path)
    assert out == ""
    assert calls == []


def test_silent_when_graph_disabled(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json",
           {"features": {"code-review-graph": False}})
    out, calls = _run_main(tmp_path)
    assert out == ""
    assert calls == []


def test_silent_when_uvx_missing(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    out, calls = _run_main(tmp_path, uvx=None)
    assert out == ""
    assert calls == []


def test_invokes_register_with_cwd_and_alias(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    out, calls = _run_main(tmp_path)
    assert out == ""
    assert len(calls) == 2
    args, _kwargs = calls[0]
    cmd = args[0]
    assert cmd[0:3] == ["uvx", "code-review-graph", "register"]
    assert cmd[3] == str(tmp_path.resolve())
    assert "--alias" in cmd
    assert cmd[cmd.index("--alias") + 1] == tmp_path.name


def test_default_on_when_features_omitted(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    out, calls = _run_main(tmp_path)
    assert len(calls) == 2
    assert out == ""


def test_warns_on_register_failure(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    failing = subprocess.CompletedProcess(
        args=[], returncode=1, stdout="", stderr="boom: registry locked"
    )
    out, _calls = _run_main(tmp_path, run_result=failing)
    assert "[BDK]" in out
    assert "boom: registry locked" in out


def test_warns_on_subprocess_exception(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    out, _calls = _run_main(tmp_path,
                            run_exc=subprocess.TimeoutExpired(cmd="uvx", timeout=30))
    assert "[BDK]" in out
    assert "register failed" in out


# ---- graph status (moved here from an ungated hooks.json line) ----

def test_prints_graph_status_after_register(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    status = subprocess.CompletedProcess(
        args=[], returncode=0, stdout="Nodes: 629\nEdges: 5196\n", stderr=""
    )
    out, calls = _run_main(tmp_path, status_result=status)
    status_cmd = calls[1][0][0]
    assert status_cmd == ["uvx", "code-review-graph", "status"]
    assert calls[1][1].get("cwd") == str(tmp_path.resolve())
    assert "Nodes: 629" in out


def test_reports_missing_graph_in_one_line(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    missing = subprocess.CompletedProcess(
        args=[], returncode=1,
        stdout="No graph found at x/graph.db. Run `code-review-graph build` first.\n",
        stderr="",
    )
    out, _calls = _run_main(tmp_path, status_result=missing)
    assert out.count("\n") == 1
    assert out.startswith("[BDK] code-review-graph status: No graph found")


def test_no_status_when_graph_disabled(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json",
           {"features": {"code-review-graph": False}})
    _out, calls = _run_main(tmp_path)
    assert all("status" not in c[0][0] for c in calls)


def test_status_still_runs_after_register_failure(tmp_path: Path):
    _write(tmp_path / ".bdk" / "settings.json", {"languages": ["python"]})
    failing = subprocess.CompletedProcess(
        args=[], returncode=1, stdout="", stderr="boom: registry locked"
    )
    _out, calls = _run_main(tmp_path, run_result=failing)
    assert calls[-1][0][0] == ["uvx", "code-review-graph", "status"]


def test_plugin_hooks_do_not_update_graph():
    """The Stop hook ran a graph update after every reply (full rebuild in
    projects without a graph). Updates are on demand, from the graph tier."""
    hooks = json.loads((REPO_ROOT / "hooks" / "hooks.json").read_text())
    commands = [h["command"] for groups in hooks["hooks"].values()
                for g in groups for h in g["hooks"]]
    assert not [c for c in commands if "uvx code-review-graph" in c]
