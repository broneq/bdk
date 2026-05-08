#!/usr/bin/env python3
"""Stop hook: detect changes matching path-scoped .claude/rules/ files.

Dynamically reads paths: frontmatter from each rule file — no hardcoded mappings.
Adding a new path-scoped rule automatically includes it in drift detection.

Returns JSON with decision=block when drift is detected, forcing Claude to
review and update the affected documentation before stopping.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from fnmatch import fnmatch
from pathlib import Path

STALE_THRESHOLD_SECONDS = 72 * 60 * 60  # 72 hours


def read_stdin_json() -> dict:  # type: ignore[type-arg]
    """Read hook input from stdin."""
    try:
        return json.loads(sys.stdin.read())
    except (json.JSONDecodeError, EOFError):
        return {}


def get_changed_files() -> list[str]:
    """Get files changed in working tree vs HEAD (staged + unstaged)."""
    for cmd in (
        ["git", "diff", "--name-only", "HEAD"],
        ["git", "diff", "--name-only", "--cached"],
        ["git", "diff", "--name-only"],
    ):
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            if result.stdout.strip():
                return result.stdout.strip().splitlines()
        except subprocess.CalledProcessError:
            continue
    return []


def get_file_mtimes(files: list[str]) -> dict[str, float]:
    """Return mtime for each file that exists on disk."""
    mtimes: dict[str, float] = {}
    for f in files:
        try:
            mtimes[f] = os.path.getmtime(f)
        except OSError:
            mtimes[f] = 0.0  # deleted file
    return mtimes


def _drift_dir() -> Path:
    """Stable directory for drift state files — immune to TMPDIR differences."""
    d = Path(".bdk/tmp/.rules_drift")
    d.mkdir(parents=True, exist_ok=True)
    return d


def _state_file(session_id: str) -> Path:
    return _drift_dir() / f"drift-{session_id}.json"


def _baseline_file(session_id: str) -> Path:
    return _drift_dir() / f"drift-baseline-{session_id}.json"


def load_seen_state(session_id: str) -> dict[str, float]:
    """Load previously seen file mtimes for this session.

    Falls back to the session baseline (pre-existing dirty files) so that
    files already dirty at session start are never reported as new.
    """
    state_file = _state_file(session_id)
    if state_file.exists():
        try:
            return json.loads(state_file.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    # No stop-hook state yet — use the session baseline written by SessionStart hook.
    baseline_file = _baseline_file(session_id)
    if baseline_file.exists():
        try:
            return json.loads(baseline_file.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_seen_state(session_id: str, mtimes: dict[str, float]) -> None:
    """Persist current file mtimes for this session."""
    _state_file(session_id).write_text(json.dumps(mtimes))


def extract_paths_from_frontmatter(rule_file: Path) -> list[str]:
    """Parse paths: list from YAML frontmatter between --- markers."""
    text = rule_file.read_text()
    lines = text.splitlines()

    if not lines or lines[0].strip() != "---":
        return []

    paths: list[str] = []
    in_paths = False

    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("paths:"):
            in_paths = True
            continue
        if in_paths and line and not line[0].isspace():
            break
        if in_paths and line.strip().startswith("- "):
            pattern = line.strip().removeprefix("- ").strip().strip("\"'")
            paths.append(pattern)

    return paths


def find_matching_rules(
    rules_dir: Path,
    changed_files: list[str],
) -> dict[str, list[str]]:
    """Match changed files against path-scoped rules.

    Returns:
        Mapping of rule filename to the changed files that triggered it.
    """
    matched: dict[str, list[str]] = {}

    for rule_file in sorted(rules_dir.glob("*.md")):
        patterns = extract_paths_from_frontmatter(rule_file)
        if not patterns:
            continue  # global rule — always loaded, no drift concern

        triggering = [f for f in changed_files if any(fnmatch(f, pattern) for pattern in patterns)]
        if triggering:
            matched[rule_file.name] = triggering

    return matched


def build_block_reason(matched: dict[str, list[str]]) -> str:
    lines = [
        "Documentation drift detected. The following rule files may need updating",
        "based on the code changes you made this session:\n",
    ]
    for rule, triggering in matched.items():
        lines.append(f"  .claude/rules/{rule}")
        for f in triggering:
            lines.append(f"    triggered by: {f}")
    lines.append(
        "\nFor each rule file: based on what you changed this session, decide if the",
    )
    lines.append(
        "documented patterns, class names, or examples are still accurate.",
    )
    lines.append(
        "Use your session context — no codebase exploration needed.",
    )
    return "\n".join(lines)


def _cleanup_stale_files() -> None:
    """Remove drift state files not touched for 72 hours."""
    drift_dir = _drift_dir()
    now = time.time()
    for f in drift_dir.iterdir():
        if f.is_file():
            try:
                if now - f.stat().st_mtime > STALE_THRESHOLD_SECONDS:
                    f.unlink()
            except OSError:
                pass


def snapshot_baseline() -> None:
    """Write mtimes of already-dirty files at session start (called via --snapshot-baseline).

    Reads session_id from stdin JSON (same format as other hooks).
    This baseline is used by the stop hook to ignore pre-existing dirty files.
    """
    _cleanup_stale_files()
    hook_input = read_stdin_json()
    session_id = hook_input.get("session_id", "unknown")
    rules_dir = Path(".claude/rules")
    if not rules_dir.is_dir():
        return
    changed_files = get_changed_files()
    matched = find_matching_rules(rules_dir, changed_files)
    triggering_files = [f for files in matched.values() for f in files]
    baseline = get_file_mtimes(triggering_files)
    _baseline_file(session_id).write_text(json.dumps(baseline))


def main() -> None:
    if "--snapshot-baseline" in sys.argv:
        snapshot_baseline()
        return

    hook_input = read_stdin_json()

    # Prevent infinite loop if hook already blocked once this session
    if hook_input.get("stop_hook_active"):
        sys.exit(0)

    session_id = hook_input.get("session_id", "unknown")

    rules_dir = Path(".claude/rules")
    if not rules_dir.is_dir():
        sys.exit(0)

    changed_files = get_changed_files()
    if not changed_files:
        sys.exit(0)

    matched = find_matching_rules(rules_dir, changed_files)
    if not matched:
        sys.exit(0)

    seen_mtimes = load_seen_state(session_id)

    # Filter to only files whose mtimes actually changed since last seen
    new_matched: dict[str, list[str]] = {}
    for rule, triggering in matched.items():
        current = get_file_mtimes(triggering)
        changed = [f for f, mtime in current.items() if seen_mtimes.get(f) != mtime]
        if changed:
            new_matched[rule] = changed

    if not new_matched:
        sys.exit(0)

    # Update seen state only for files being reported now
    reported_files = [f for files in new_matched.values() for f in files]
    updated_mtimes = {**seen_mtimes, **get_file_mtimes(reported_files)}
    save_seen_state(session_id, updated_mtimes)

    print(
        json.dumps(
            {
                "decision": "block",
                "reason": build_block_reason(new_matched),
            }
        )
    )

    sys.exit(0)


if __name__ == "__main__":
    main()
