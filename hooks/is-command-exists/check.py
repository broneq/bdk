#!/usr/bin/env python3
"""UserPromptSubmit hook: verify a system command exists in PATH.

Usage: check.py <command> [install-hint]

Exits silently when command found. Warns via stderr and exits 2 when missing.

Example:
  check.py dot "brew install graphviz"
  check.py dot
"""

from __future__ import annotations

import shutil
import sys


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(0)

    command = sys.argv[1]
    install_hint = sys.argv[2] if len(sys.argv) >= 3 else None

    if shutil.which(command) is None:
        msg = f"[BDK] Command '{command}' not found in PATH. This skill requires it to be installed."
        if install_hint:
            msg += f" Install: {install_hint}"
        print(msg, file=sys.stderr)
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
