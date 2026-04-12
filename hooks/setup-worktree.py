#!/usr/bin/env python3
"""WorktreeCreate hook: creates git worktree, symlinks .env, sets up Python venv.

Reads JSON input from stdin. Prints the worktree path on stdout.
All diagnostic output goes to stderr.
"""

import json
import subprocess
import sys
from pathlib import Path


def log(msg: str) -> None:
    print(f"[worktree-setup] {msg}", file=sys.stderr)


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)


def main() -> None:
    event = json.load(sys.stdin)
    name = event["name"]
    cwd = Path(event["cwd"])

    worktree_dir = cwd / ".claude" / "worktrees" / name

    # 1. Create git worktree (capture stdout+stderr to keep our stdout clean)
    run(["git", "worktree", "add", str(worktree_dir), "HEAD", "--detach"])
    log(f"Created git worktree: {worktree_dir}")

    # 2. Symlink .env from main repo if it exists
    env_file = cwd / ".env"
    if env_file.exists():
        target = worktree_dir / ".env"
        target.symlink_to(env_file)
        log("Symlinked .env")

    # 3. Create Python venv and install dependencies
    run(["uv", "venv"], cwd=worktree_dir)
    log("Created venv")

    venv_python = worktree_dir / ".venv" / "bin" / "python"
    run(
        ["uv", "pip", "install", "-e", ".[dev]", "--python", str(venv_python)],
        cwd=worktree_dir,
    )
    log("Installed dependencies")

    # 4. Print worktree path on stdout (required by WorktreeCreate contract)
    print(worktree_dir)


if __name__ == "__main__":
    main()
