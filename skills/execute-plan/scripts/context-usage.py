#!/usr/bin/env python3
"""Report current context window usage after each TaskCompleted."""

from __future__ import annotations

import json
import subprocess
import sys

# Context window sizes by model (in tokens)
MODEL_CONTEXT_SIZES: dict[str, int] = {
    "claude-opus-4-6": 200_000,
    "claude-sonnet-4-6": 200_000,
    "claude-haiku-4-5": 200_000,
}
DEFAULT_CONTEXT_SIZE = 200_000


def get_context_size(model: str) -> int:
    for prefix, size in MODEL_CONTEXT_SIZES.items():
        if model.startswith(prefix):
            return size
    return DEFAULT_CONTEXT_SIZE


def read_latest_usage(transcript_path: str) -> tuple[int, str] | None:
    """Read the most recent assistant message usage from the transcript.

    Returns:
        Tuple of (total_input_tokens, model) or None if not found.
    """
    last_usage = None
    last_model = None
    try:
        with open(transcript_path) as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    msg = entry.get("message", {})
                    if msg.get("role") == "assistant" and msg.get("usage"):
                        last_usage = msg["usage"]
                        last_model = msg.get("model", "")
                except (json.JSONDecodeError, KeyError):
                    continue
    except OSError:
        return None

    if last_usage is None:
        return None

    total = (
        last_usage.get("input_tokens", 0)
        + last_usage.get("cache_creation_input_tokens", 0)
        + last_usage.get("cache_read_input_tokens", 0)
    )
    return total, last_model or ""


def get_branch_slug(cwd: str) -> str:
    try:
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=cwd,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        # Strip common prefixes like feat/, fix/, poc/
        slug = branch.split("/")[-1] if "/" in branch else branch
        return slug or "my-work"
    except Exception:
        return "my-work"


data = json.load(sys.stdin)
transcript_path = data.get("transcript_path", "")
cwd = data.get("cwd", ".")

if not transcript_path:
    sys.exit(0)

result = read_latest_usage(transcript_path)
if result is None:
    sys.exit(0)

total_tokens, model = result
context_size = get_context_size(model)
pct = total_tokens * 100 // context_size

if pct >= 50:
    slug = get_branch_slug(cwd)
    print(
        json.dumps(
            {
                "continue": False,
                "stopReason": f"⚠️ Context at {pct}% ({total_tokens:,} / {context_size:,} tokens). Run /bdk:save-progress {slug} before continuing.",
            }
        )
    )
