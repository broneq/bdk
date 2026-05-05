#!/usr/bin/env python3
"""Print argv[1] verbatim. Used by Phase 0 sentinel eval.

Exists solely to provide deterministic stdout for the
`tests/evals/skills/bdk-injection-preload/` regression eval that
verifies !-block execution under `skills:` preload on plugin
subagents. See docs/INJECTION-FLOWS.md, "Verification status".
"""

from __future__ import annotations

import sys


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(0)
    print(sys.argv[1], end="")


if __name__ == "__main__":
    main()
