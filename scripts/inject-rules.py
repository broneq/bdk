#!/usr/bin/env python3
"""Print the resolved text of one quality rule set.

Usage:
    python3 inject-rules.py <rule-name>

The text is the prompt value `rules/<rule-name>` (`kernel-settings`, Prompt
values): the plugin's `rules/<rule-name>.md`, extended or replaced by the
files of the global, project and local layers (`.bdk/prompts/rules/`, or a
file mapped by `prompts.files`). The kernel resolves it; this script prints it.

Failures print ``[bdk-inject-error] <description>`` to **stdout** and exit 0.
This script is consumed from a ``!`...`` `` block in a skill body, which captures
stdout only and ignores the exit code, so stderr + exit 1 renders as silence -
a missing rule file would look exactly like a rule set that is legitimately
empty. See scripts/inject.py for the same contract.

Public API:
    from inject_rules import resolve_rule
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kernel_settings import ERR_PREFIX, KernelSettingsError, error_line, prompt_text

__all__ = ["KernelSettingsError", "resolve_rule"]


def resolve_rule(name: str, cwd: Path | None = None) -> str:
    """The resolved text of rule set `name`.

    Raises KernelSettingsError when the kernel refuses (an unknown rule set, a
    broken setting) and FileNotFoundError when no layer and no default has it.
    """
    text = prompt_text(f"rules/{name}", cwd)
    if text is None:
        raise FileNotFoundError(f"rules/{name}: no plugin default and no prompt file")
    return text


def main() -> None:
    if len(sys.argv) < 2:
        print(f"{ERR_PREFIX} usage: inject-rules.py <rule-name>")
        sys.exit(0)
    try:
        content = resolve_rule(sys.argv[1])
    except KernelSettingsError as error:
        print(error_line(error))
        sys.exit(0)
    except (FileNotFoundError, OSError) as error:
        print(f"{ERR_PREFIX} {error}")
        sys.exit(0)
    print(content, end="")
    sys.exit(0)


if __name__ == "__main__":
    main()
