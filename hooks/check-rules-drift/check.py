#!/usr/bin/env python3
"""Stop hook: detect changes matching path-scoped .claude/rules/ files.

Dynamically reads paths: frontmatter from each rule file - no hardcoded mappings.
Adding a new path-scoped rule automatically includes it in drift detection.

Returns JSON with decision=block when drift is detected, forcing Claude to
review and update the affected documentation before stopping.

Cursor semantics
----------------
Per session the hook keeps ``.bdk/tmp/.rules_drift/drift-<session_id>.json``:
a map of file path -> content fingerprint (sha256) as of the LAST Stop hook run.
``--snapshot-baseline`` (SessionStart) seeds that file with fingerprints of files
already dirty at session start, so they are never reported as session edits. It
never overwrites an existing cursor (SessionStart also fires on resume).

Every Stop run - including runs that stay silent and runs short-circuited by
``stop_hook_active`` - re-fingerprints all matched files and persists the result
BEFORE deciding anything. A file is therefore reported iff its content differs
from what it was at the previous Stop hook run of this session. Edits made while
fixing drift inside a blocked continuation are absorbed by the guarded run and
are not reported again on the next turn.

Fingerprints are content hashes, not mtimes: formatters, codegen and git
checkouts that rewrite identical bytes do not count as changes.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import time
from fnmatch import fnmatch
from pathlib import Path

STALE_THRESHOLD_SECONDS = 72 * 60 * 60  # 72 hours

DELETED = "deleted"  # fingerprint sentinel for files missing on disk

# A rule whose paths match every file is effectively global: nothing
# path-specific can drift, and matching it would turn every doc edit made in
# response to a block into next turn's trigger.
UNIVERSAL_PATTERNS = frozenset({"**", "*", "**/*"})


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


def get_file_fingerprints(files: list[str]) -> dict[str, str]:
    """Return a content fingerprint (sha256 hex) per file; DELETED if unreadable."""
    fingerprints: dict[str, str] = {}
    for f in files:
        try:
            fingerprints[f] = hashlib.sha256(Path(f).read_bytes()).hexdigest()
        except OSError:
            fingerprints[f] = DELETED
    return fingerprints


def _drift_dir() -> Path:
    """Stable directory for drift state files - immune to TMPDIR differences."""
    d = Path(".bdk/tmp/.rules_drift")
    d.mkdir(parents=True, exist_ok=True)
    return d


def _state_file(session_id: str) -> Path:
    return _drift_dir() / f"drift-{session_id}.json"


def load_seen_state(session_id: str) -> dict[str, str]:
    """Load fingerprints recorded at the previous hook run for this session."""
    state_file = _state_file(session_id)
    if state_file.exists():
        try:
            return json.loads(state_file.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_seen_state(session_id: str, fingerprints: dict[str, str]) -> None:
    """Persist current file fingerprints for this session."""
    _state_file(session_id).write_text(json.dumps(fingerprints))


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


def is_universal_pattern(pattern: str) -> bool:
    """True when the glob matches every path (see UNIVERSAL_PATTERNS)."""
    return pattern.strip().strip("\"'").removeprefix("./") in UNIVERSAL_PATTERNS


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
        if not patterns or any(is_universal_pattern(p) for p in patterns):
            continue  # global rule - always loaded, no drift concern

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
        "Use your session context - no codebase exploration needed.",
    )
    lines.append(
        "\nDon't trust the existing wording just because it's already there - rule files",
    )
    lines.append(
        "accumulate content from many different sessions and agents, and prior text earns",
    )
    lines.append(
        "no credit for having survived this long. Verify any claim you touch against what",
    )
    lines.append(
        "you actually changed, not against what the file already asserts.",
    )
    lines.append(
        "\nRoute anything you are tempted to write down:",
    )
    lines.append(
        "  cross-cutting invariant that fails silently -> a rule file",
    )
    lines.append(
        "  trap visible at the code site               -> a doc comment there",
    )
    lines.append(
        "  a test or lint already enforces it          -> one line naming the enforcer",
    )
    lines.append(
        "  anything else                               -> nothing",
    )
    lines.append(
        "\nA line that a rename or a file move would force you to edit is a code mirror,",
    )
    lines.append(
        "not a rule - it belongs at the code site or nowhere. Skip changelog-style",
    )
    lines.append(
        "narration (\"switched from X to Y\"), dated notes, and ticket ids offered as the",
    )
    lines.append(
        "only rationale.",
    )
    lines.append(
        "\n\"Nothing\" is a frequent, correct outcome here - do not write a rule just to",
    )
    lines.append(
        "have written something. For a full routing pass, run /bdk:add-rule.",
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


def _matched_files(matched: dict[str, list[str]]) -> list[str]:
    """Flatten rule -> files into a sorted, de-duplicated file list."""
    return sorted({f for files in matched.values() for f in files})


def snapshot_baseline() -> None:
    """Seed the session cursor with fingerprints of already-dirty files.

    Called via --snapshot-baseline from SessionStart. Reads session_id from
    stdin JSON (same format as other hooks). Never overwrites an existing
    cursor - SessionStart also fires on resume, mid-session.
    """
    _cleanup_stale_files()
    hook_input = read_stdin_json()
    session_id = hook_input.get("session_id", "unknown")
    if _state_file(session_id).exists():
        return
    rules_dir = Path(".claude/rules")
    if not rules_dir.is_dir():
        return
    matched = find_matching_rules(rules_dir, get_changed_files())
    save_seen_state(session_id, get_file_fingerprints(_matched_files(matched)))


def main() -> None:
    if "--snapshot-baseline" in sys.argv:
        snapshot_baseline()
        return

    hook_input = read_stdin_json()
    session_id = hook_input.get("session_id", "unknown")

    rules_dir = Path(".claude/rules")
    if not rules_dir.is_dir():
        sys.exit(0)

    matched = find_matching_rules(rules_dir, get_changed_files())

    # Advance the cursor on EVERY run, before any decision to stay silent.
    # The same fingerprint pass drives both the comparison and the save, so a
    # file touched between two stats cannot be swallowed.
    seen = load_seen_state(session_id)
    current = get_file_fingerprints(_matched_files(matched))
    save_seen_state(session_id, {**seen, **current})

    # Prevent infinite loop if hook already blocked once this turn
    if hook_input.get("stop_hook_active"):
        sys.exit(0)

    new_matched: dict[str, list[str]] = {}
    for rule, triggering in matched.items():
        changed = [f for f in triggering if seen.get(f) != current[f]]
        if changed:
            new_matched[rule] = changed

    if not new_matched:
        sys.exit(0)

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
