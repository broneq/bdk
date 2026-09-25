#!/usr/bin/env python3
"""SessionStart hook: register cwd in code-review-graph and print graph status.

The graph MCP server (`code-review-graph serve`) auto-detects the active
repo from the cwd of its host process. But the registry that powers
`cross_repo_search_tool` and stable cross-session lookups is empty until
each project is registered once via `code-review-graph register <path>`.

This hook registers the current cwd on every SessionStart. The CLI is
idempotent — re-registering an existing path is a no-op — so it is safe
to run unconditionally.

It then prints `code-review-graph status` (node / edge counts, last
update, branch) so the session knows how fresh the graph is, or a one-line
note when no graph exists yet. Status lives here rather than in hooks.json
so it shares the gating below: an ungated hooks.json line ran in every
project with the plugin enabled.

Prints a one-line warning if registration fails. Always exits 0.

Skipped silently when:
- .bdk/settings.json missing (project not configured for BDK)
- features.code-review-graph explicitly false
- uvx not on PATH
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _read_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None


def _graph_enabled(settings: dict) -> bool:
    """Default-on: only disabled if features.code-review-graph is explicitly False."""
    features = settings.get("features", {})
    if not isinstance(features, dict):
        return True
    return features.get("code-review-graph", True) is not False


def main() -> None:
    sys.stdin.read()  # consume hook stdin

    project_root = Path(os.getcwd()).resolve()

    settings = _read_json(project_root / ".bdk" / "settings.json")
    if settings is None:
        sys.exit(0)

    if not _graph_enabled(settings):
        sys.exit(0)

    if shutil.which("uvx") is None:
        sys.exit(0)

    alias = project_root.name
    try:
        result = subprocess.run(
            ["uvx", "code-review-graph", "register", str(project_root), "--alias", alias],
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"[BDK] code-review-graph register failed: {exc}")
        sys.exit(0)

    if result.returncode != 0:
        stderr = (result.stderr or result.stdout or "").strip().splitlines()
        first_line = stderr[0] if stderr else "unknown error"
        print(f"[BDK] code-review-graph register failed: {first_line}")

    _print_status(project_root)
    sys.exit(0)


def _print_status(project_root: Path) -> None:
    try:
        result = subprocess.run(
            ["uvx", "code-review-graph", "status"],
            capture_output=True,
            check=False,
            text=True,
            timeout=10,
            cwd=str(project_root),
        )
    except (subprocess.TimeoutExpired, OSError) as exc:
        print(f"[BDK] code-review-graph status: {exc}")
        return

    if result.returncode == 0:
        print(result.stdout, end="")
        return
    lines = (result.stdout or result.stderr or "").strip().splitlines()
    print(f"[BDK] code-review-graph status: {lines[0] if lines else 'unknown error'}")


if __name__ == "__main__":
    main()
