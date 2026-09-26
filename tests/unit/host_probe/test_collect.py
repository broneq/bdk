"""Tests for tests/host-probe/collect.mjs and a leak guard over recorded fixtures.

Recorded host payloads are committed to a public repo, so anonymisation is the
part of the probe that must not regress.
"""

import getpass
import json
import os
import re
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[3]
COLLECT = REPO / "tests" / "host-probe" / "collect.mjs"
FIXTURES = REPO / "tests" / "fixtures" / "host-payloads"

HOME = "/Users/alice"
PROJECT = "/private/tmp/probe/work-project"
SESSION = "8cc1c683-fc2f-406c-8ffa-580ff15b26fa"
OTHER_SESSION = "11111111-2222-3333-4444-555555555555"


def encoded(path: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in path)


def payload(session: str = SESSION, **extra) -> dict:
    return {
        "session_id": session,
        "transcript_path": f"{HOME}/.claude/projects/{encoded(PROJECT)}/{session}.jsonl",
        "cwd": PROJECT,
        "scratchpad_dir": f"{HOME}/tmp/alice-scratch",
        "prompt_id": "c85dfd80-14a9-44a1-8480-2f788aec0b6d",
        "permission_mode": "default",
        "hook_event_name": "PreToolUse",
        "tool_name": "Bash",
        "tool_input": {
            "command": f"ls {PROJECT}/src",
            "timeout": 120000,
            "run_in_background": False,
        },
        "tool_use_id": "toolu_01AbCdEf",
        **extra,
    }


def run_collect(tmp_path: Path, *pairs: str, recordings: dict[str, dict] | None = None):
    out = tmp_path / ".probe-out"
    out.mkdir(exist_ok=True)
    for name, body in (recordings or {}).items():
        (out / name).write_text(json.dumps(body))
    dest = tmp_path / "fixtures"
    env = {
        **os.environ,
        "HOME": HOME,
        "PROBE_OUT": str(out),
        "PROBE_PROJECT": PROJECT,
        "BDK_FIXTURES": str(dest),
    }
    result = subprocess.run(
        ["node", str(COLLECT), "9.9.9", *pairs],
        capture_output=True,
        text=True,
        env=env,
        cwd=tmp_path,
    )
    return result, dest / "9.9.9"


def read_fixture(dest: Path, check_id: str) -> dict:
    return json.loads((dest / f"{check_id}.json").read_text())


def test_paths_are_replaced_including_encoded_forms(tmp_path):
    result, dest = run_collect(
        tmp_path, "pre-bash=*-PreToolUse.json", recordings={"1-1-PreToolUse.json": payload()}
    )
    assert result.returncode == 0, result.stderr
    text = (dest / "pre-bash.json").read_text()
    for leak in (HOME, PROJECT, encoded(PROJECT), encoded(HOME), "alice"):
        assert leak not in text, f"leaked {leak!r}: {text}"
    p = read_fixture(dest, "pre-bash")["payloads"][0]
    assert p["cwd"] == "<PROJECT>"
    assert p["tool_input"]["command"] == "ls <PROJECT>/src"
    assert p["transcript_path"].startswith("<HOME>/.claude/projects/<PROJECT>/")
    assert p["scratchpad_dir"] == "<HOME>/tmp/<USER>-scratch"


def test_plugin_root_is_replaced(tmp_path):
    probe_dir = str(COLLECT.parent)
    body = payload(tool_input={"command": f"node {probe_dir}/dist/bdk.mjs ping"})
    result, dest = run_collect(
        tmp_path, "root=*-PreToolUse.json", recordings={"1-1-PreToolUse.json": body}
    )
    assert result.returncode == 0, result.stderr
    p = read_fixture(dest, "root")["payloads"][0]
    assert p["tool_input"]["command"] == "node <PLUGIN_ROOT>/dist/bdk.mjs ping"


@pytest.mark.parametrize("prefix", ["/private/tmp/claude-502", "/tmp/claude-502"])
def test_per_user_claude_temp_dir_is_replaced(tmp_path, prefix):
    body = payload(scratchpad_dir=f"{prefix}/{encoded(PROJECT)}/{SESSION}/scratchpad")
    result, dest = run_collect(
        tmp_path, "tmp=*-PreToolUse.json", recordings={"1-1-PreToolUse.json": body}
    )
    assert result.returncode == 0, result.stderr
    p = read_fixture(dest, "tmp")["payloads"][0]
    assert p["scratchpad_dir"] == f"<CLAUDE_TMP>/<PROJECT>/{p['session_id']}/scratchpad"


def test_ids_map_to_stable_placeholders(tmp_path):
    result, dest = run_collect(
        tmp_path,
        "two=*-PreToolUse.json",
        recordings={
            "1-1-PreToolUse.json": payload(),
            "2-2-PreToolUse.json": payload(),
            "3-3-PreToolUse.json": payload(session=OTHER_SESSION),
        },
    )
    assert result.returncode == 0, result.stderr
    first, second, third = read_fixture(dest, "two")["payloads"]
    assert first["session_id"] == second["session_id"]
    assert first["session_id"] != third["session_id"]
    assert first["session_id"].startswith("<SESSION-")
    assert first["transcript_path"].endswith(f"/{first['session_id']}.jsonl")
    assert first["tool_use_id"].startswith("<TOOL-USE-")
    assert first["prompt_id"].startswith("<PROMPT-")
    assert SESSION not in json.dumps(first)


def test_keys_types_and_nesting_are_kept(tmp_path):
    body = payload(agent_id="a1b2c3d4e5", agent_type="bdk-probe:probe-worker")
    result, dest = run_collect(
        tmp_path, "agent=*-PreToolUse.json", recordings={"1-1-PreToolUse.json": body}
    )
    assert result.returncode == 0, result.stderr
    p = read_fixture(dest, "agent")["payloads"][0]
    assert set(p) == set(body)
    assert p["tool_input"]["timeout"] == 120000
    assert p["tool_input"]["run_in_background"] is False
    assert p["agent_id"].startswith("<AGENT-")
    assert p["agent_type"] == "bdk-probe:probe-worker"


def test_probe_metadata_is_added(tmp_path):
    result, dest = run_collect(
        tmp_path, "meta=*-PreToolUse.json", recordings={"1-1-PreToolUse.json": payload()}
    )
    assert result.returncode == 0, result.stderr
    probe = read_fixture(dest, "meta")["_probe"]
    assert probe["claude_code_version"] == "9.9.9"
    assert probe["check_id"] == "meta"
    assert probe["recordings"] == 1


def test_missing_recording_fails_and_names_the_check(tmp_path):
    result, dest = run_collect(
        tmp_path, "absent=*-SessionEnd.json", recordings={"1-1-PreToolUse.json": payload()}
    )
    assert result.returncode != 0
    assert "absent" in result.stderr
    assert not (dest / "absent.json").exists()


def leaks(text: str, user: str) -> list[str]:
    """Machine data found in text: home prefixes (plain or dash-encoded) and the username.

    The username only counts as a standalone token, so a short CI user such as
    `runner` does not match the agent name `bdk:test-runner`.
    """
    found = [marker for marker in ("/Users/", "/home/", "-Users-", "-home-") if marker in text]
    if re.search(rf"(?<![A-Za-z0-9_-]){re.escape(user)}(?![A-Za-z0-9_])", text):
        found.append(user)
    return found


@pytest.mark.parametrize(
    "text",
    [
        "/Users/alice/x",
        "-Users-alice-project",
        "/tmp/alice-scratch",
        "owner: alice",
    ],
)
def test_leak_guard_flags_machine_data(text):
    assert leaks(text, "alice")


@pytest.mark.parametrize("text", ["bdk:test-runner", "runners", "<USER>-scratch"])
def test_leak_guard_ignores_username_inside_other_names(text):
    assert leaks(text, "runner") == []


def committed_fixtures():
    return sorted(FIXTURES.rglob("*.json")) if FIXTURES.exists() else []


@pytest.mark.parametrize(
    "fixture", committed_fixtures(), ids=lambda p: str(p.relative_to(FIXTURES))
)
def test_committed_fixtures_do_not_leak_machine_data(fixture):
    found = leaks(fixture.read_text(), getpass.getuser())
    assert not found, f"{fixture} leaks {found!r}"
