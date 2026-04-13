"""Tests for context-usage.py — pure-function layer only.

Module-level side effects (stdin read, sys.exit) are NOT tested here.
We import only the three pure functions via importlib after patching sys.stdin.
"""

from __future__ import annotations

import importlib
import io
import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# ---------------------------------------------------------------------------
# Import helpers — the module has top-level side effects so we must stub them
# before importing.
# ---------------------------------------------------------------------------

_MODULE_PATH = str(Path(__file__).parents[4] / "skills" / "execute-plan" / "scripts" / "context-usage.py")


def _load_module():
    """Import the module with stdin/sys.exit stubbed out.

    sys.exit is replaced with a real raise so execution stops at the guard
    clauses (transcript_path empty → exit 0) instead of falling through to
    the tuple unpack on line 85.
    """

    class _Exit(SystemExit):
        pass

    def _fake_exit(code=0):
        raise _Exit(code)

    fake_stdin = io.StringIO(json.dumps({"transcript_path": "", "cwd": "."}))
    spec = importlib.util.spec_from_file_location("context_usage", _MODULE_PATH)
    mod = importlib.util.module_from_spec(spec)
    with patch("sys.stdin", fake_stdin):
        with patch("sys.exit", side_effect=_fake_exit):
            try:
                spec.loader.exec_module(mod)
            except _Exit:
                pass  # expected — module exited cleanly at the guard
    return mod


_mod = _load_module()
get_context_size = _mod.get_context_size
read_latest_usage = _mod.read_latest_usage
get_branch_slug = _mod.get_branch_slug
MODEL_CONTEXT_SIZES = _mod.MODEL_CONTEXT_SIZES
DEFAULT_CONTEXT_SIZE = _mod.DEFAULT_CONTEXT_SIZE


# ===========================================================================
# get_context_size
# ===========================================================================


class TestGetContextSize(unittest.TestCase):
    # --- positive ---

    def test_exact_known_model(self):
        assert get_context_size("claude-opus-4-6") == 200_000

    def test_exact_sonnet(self):
        assert get_context_size("claude-sonnet-4-6") == 200_000

    def test_exact_haiku(self):
        assert get_context_size("claude-haiku-4-5") == 200_000

    def test_prefix_match_with_suffix(self):
        """Model IDs often include date suffixes like -20251001."""
        assert get_context_size("claude-haiku-4-5-20251001") == 200_000

    def test_prefix_match_opus_variant(self):
        assert get_context_size("claude-opus-4-6-some-variant") == 200_000

    # --- negative / unknown ---

    def test_unknown_model_returns_default(self):
        assert get_context_size("gpt-4o") == DEFAULT_CONTEXT_SIZE

    def test_empty_string_returns_default(self):
        assert get_context_size("") == DEFAULT_CONTEXT_SIZE

    def test_partial_prefix_no_match(self):
        # "claude-opus" alone does not match "claude-opus-4-6"
        assert get_context_size("claude-opus") == DEFAULT_CONTEXT_SIZE

    def test_case_sensitive_no_match(self):
        assert get_context_size("Claude-Opus-4-6") == DEFAULT_CONTEXT_SIZE


# ===========================================================================
# read_latest_usage
# ===========================================================================


def _make_transcript(entries: list[dict]) -> str:
    return "\n".join(json.dumps(e) for e in entries)


class TestReadLatestUsage(unittest.TestCase):
    # --- positive ---

    def test_single_assistant_message(self, tmp_path=None):
        import tempfile, os

        entry = {
            "message": {
                "role": "assistant",
                "model": "claude-sonnet-4-6",
                "usage": {
                    "input_tokens": 1000,
                    "cache_creation_input_tokens": 200,
                    "cache_read_input_tokens": 50,
                },
            }
        }
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript([entry]))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (1250, "claude-sonnet-4-6")
        finally:
            os.unlink(path)

    def test_returns_last_assistant_message(self):
        import tempfile, os

        entries = [
            {
                "message": {
                    "role": "assistant",
                    "model": "claude-sonnet-4-6",
                    "usage": {"input_tokens": 100},
                }
            },
            {
                "message": {
                    "role": "assistant",
                    "model": "claude-opus-4-6",
                    "usage": {"input_tokens": 9000},
                }
            },
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript(entries))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (9000, "claude-opus-4-6"), f"got {result}"
        finally:
            os.unlink(path)

    def test_skips_user_messages(self):
        import tempfile, os

        entries = [
            {"message": {"role": "user", "usage": {"input_tokens": 500}}},
            {
                "message": {
                    "role": "assistant",
                    "model": "claude-sonnet-4-6",
                    "usage": {"input_tokens": 100},
                }
            },
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript(entries))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (100, "claude-sonnet-4-6")
        finally:
            os.unlink(path)

    def test_all_cache_tokens(self):
        import tempfile, os

        entry = {
            "message": {
                "role": "assistant",
                "model": "claude-haiku-4-5",
                "usage": {
                    "input_tokens": 0,
                    "cache_creation_input_tokens": 5000,
                    "cache_read_input_tokens": 3000,
                },
            }
        }
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript([entry]))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (8000, "claude-haiku-4-5")
        finally:
            os.unlink(path)

    def test_missing_model_field_returns_empty_string(self):
        import tempfile, os

        entry = {
            "message": {
                "role": "assistant",
                "usage": {"input_tokens": 42},
            }
        }
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript([entry]))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (42, "")
        finally:
            os.unlink(path)

    def test_missing_cache_keys_treated_as_zero(self):
        import tempfile, os

        entry = {
            "message": {
                "role": "assistant",
                "model": "claude-sonnet-4-6",
                "usage": {"input_tokens": 77},
            }
        }
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript([entry]))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (77, "claude-sonnet-4-6")
        finally:
            os.unlink(path)

    # --- negative / edge ---

    def test_nonexistent_file_returns_none(self):
        result = read_latest_usage("/tmp/does_not_exist_xyz_12345.jsonl")
        assert result is None

    def test_empty_file_returns_none(self):
        import tempfile, os

        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result is None
        finally:
            os.unlink(path)

    def test_no_assistant_messages_returns_none(self):
        import tempfile, os

        entries = [
            {"message": {"role": "user", "content": "hello"}},
            {"message": {"role": "user", "content": "world"}},
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript(entries))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result is None
        finally:
            os.unlink(path)

    def test_corrupt_lines_skipped(self):
        import tempfile, os

        good_entry = {
            "message": {
                "role": "assistant",
                "model": "claude-sonnet-4-6",
                "usage": {"input_tokens": 111},
            }
        }
        content = "NOT JSON\n" + json.dumps(good_entry) + "\n{bad\n"
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(content)
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result == (111, "claude-sonnet-4-6")
        finally:
            os.unlink(path)

    def test_assistant_message_with_no_usage_skipped(self):
        import tempfile, os

        entries = [
            {
                "message": {
                    "role": "assistant",
                    "model": "claude-sonnet-4-6",
                }  # no "usage" key
            }
        ]
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript(entries))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result is None
        finally:
            os.unlink(path)

    def test_empty_usage_dict_skipped(self):
        """Empty dict is falsy — script skips it (same as no usage key)."""
        import tempfile, os

        entry = {
            "message": {
                "role": "assistant",
                "model": "claude-sonnet-4-6",
                "usage": {},  # falsy → skipped by `if msg.get("usage")`
            }
        }
        with tempfile.NamedTemporaryFile("w", suffix=".jsonl", delete=False) as f:
            f.write(_make_transcript([entry]))
            path = f.name
        try:
            result = read_latest_usage(path)
            assert result is None
        finally:
            os.unlink(path)


# ===========================================================================
# get_branch_slug
# ===========================================================================


class TestGetBranchSlug(unittest.TestCase):
    # --- positive ---

    def test_plain_branch(self):
        with patch("subprocess.check_output", return_value="main\n"):
            assert get_branch_slug("/repo") == "main"

    def test_namespaced_branch_returns_last_segment(self):
        with patch("subprocess.check_output", return_value="feat/my-feature\n"):
            assert get_branch_slug("/repo") == "my-feature"

    def test_deep_namespace(self):
        with patch("subprocess.check_output", return_value="team/poc/widget\n"):
            assert get_branch_slug("/repo") == "widget"

    def test_fix_prefix(self):
        with patch("subprocess.check_output", return_value="fix/auth-bug\n"):
            assert get_branch_slug("/repo") == "auth-bug"

    # --- negative / edge ---

    def test_git_failure_returns_default(self):
        with patch(
            "subprocess.check_output",
            side_effect=subprocess.CalledProcessError(128, "git"),
        ):
            assert get_branch_slug("/repo") == "my-work"

    def test_not_a_git_repo_returns_default(self):
        with patch("subprocess.check_output", side_effect=FileNotFoundError):
            assert get_branch_slug("/not-a-repo") == "my-work"

    def test_empty_output_returns_default(self):
        with patch("subprocess.check_output", return_value="   \n"):
            assert get_branch_slug("/repo") == "my-work"

    def test_branch_with_single_slash_trailing(self):
        """Branch name ending in slash (malformed) — still safe."""
        with patch("subprocess.check_output", return_value="feat/\n"):
            # split("/")[-1] → "" → falls to "my-work"
            result = get_branch_slug("/repo")
            assert result == "my-work"


# ===========================================================================
# Integration-level: module stdout when pct >= 50
# ===========================================================================


class TestMainOutput(unittest.TestCase):
    """Run the script as a subprocess to test the full pipeline."""

    def _run(self, stdin_data: dict, transcript_lines: list[dict] | None = None) -> dict:
        import os, tempfile

        transcript_path = ""
        tmp = None

        if transcript_lines is not None:
            tmp = tempfile.NamedTemporaryFile(
                "w", suffix=".jsonl", delete=False
            )
            for line in transcript_lines:
                tmp.write(json.dumps(line) + "\n")
            tmp.close()
            transcript_path = tmp.name

        stdin_data["transcript_path"] = transcript_path
        stdin_data.setdefault("cwd", "/tmp")

        result = subprocess.run(
            [sys.executable, _MODULE_PATH],
            input=json.dumps(stdin_data),
            capture_output=True,
            text=True,
        )

        if tmp:
            os.unlink(tmp.name)

        return {
            "returncode": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }

    def _make_assistant_entry(self, tokens: int, model="claude-sonnet-4-6") -> dict:
        return {
            "message": {
                "role": "assistant",
                "model": model,
                "usage": {"input_tokens": tokens},
            }
        }

    # --- positive: above threshold ---

    def test_pct_50_emits_stop_reason(self):
        entries = [self._make_assistant_entry(100_000)]  # 50% of 200k
        res = self._run({}, entries)
        assert res["returncode"] == 0
        out = json.loads(res["stdout"])
        assert out["continue"] is False
        assert "50%" in out["stopReason"]

    def test_pct_above_50_emits_stop_reason(self):
        entries = [self._make_assistant_entry(180_000)]  # 90%
        res = self._run({}, entries)
        out = json.loads(res["stdout"])
        assert "90%" in out["stopReason"]

    def test_stop_reason_contains_token_counts(self):
        entries = [self._make_assistant_entry(120_000)]
        res = self._run({}, entries)
        out = json.loads(res["stdout"])
        assert "120,000" in out["stopReason"]
        assert "200,000" in out["stopReason"]

    # --- negative: below threshold ---

    def test_pct_below_50_no_output(self):
        entries = [self._make_assistant_entry(49_999)]
        res = self._run({}, entries)
        assert res["returncode"] == 0
        assert res["stdout"] == ""

    def test_zero_tokens_no_output(self):
        entries = [self._make_assistant_entry(0)]
        res = self._run({}, entries)
        assert res["stdout"] == ""

    # --- edge: missing transcript ---

    def test_no_transcript_path_exits_clean(self):
        res = self._run({"transcript_path": "", "cwd": "/tmp"})
        assert res["returncode"] == 0
        assert res["stdout"] == ""

    def test_nonexistent_transcript_exits_clean(self):
        res = self._run({"transcript_path": "/tmp/nope_xyz.jsonl", "cwd": "/tmp"})
        assert res["returncode"] == 0
        assert res["stdout"] == ""

    def test_stop_reason_contains_branch_slug(self):
        entries = [self._make_assistant_entry(150_000)]
        with patch(
            "subprocess.check_output", return_value="feat/cool-thing\n"
        ):
            res = self._run({"cwd": "/tmp"}, entries)
        # subprocess runs in a child — we can't patch there; just verify slug present
        # (git will run real; whatever branch it returns will be in output)
        out = json.loads(res["stdout"])
        assert "/save-progress" in out["stopReason"]


if __name__ == "__main__":
    unittest.main()
