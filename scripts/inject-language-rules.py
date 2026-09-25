#!/usr/bin/env python3
"""Print the resolved rule text of the project's languages.

Usage:
    python3 inject-language-rules.py                  # every language in `languages`
    python3 inject-language-rules.py <lang>           # one language only

A language's text is the prompt value `rules/languages/<lang>` (`kernel-settings`,
Prompt values): the plugin's `rules/languages/<lang>.md` when it ships one,
extended or replaced by the files of the global, project and local layers. The
kernel resolves `languages` and the prompt values; this script prints them.

Behaviour:
    - No `languages` → silent exit 0
    - Language without a default or a prompt file → silent skip
    - Multiple languages → concatenated with blank-line separator

Failures print ``[bdk-inject-error] <description>`` to **stdout** and exit 0.
This script is consumed from a ``!`...`` `` block in a skill body, which captures
stdout only and ignores the exit code, so stderr + exit 1 renders as silence.
See scripts/inject.py for the same contract.

Public API:
    from inject_language_rules import resolve_language_rule, resolve_all
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kernel_settings import (  # noqa: E402
    ERR_PREFIX,
    KernelSettingsError,
    error_line,
    load_settings,
    prompt_text,
)


def resolve_language_rule(lang: str, cwd: Path | None = None) -> str | None:
    """The resolved rule text of one language; None when nothing applies."""
    return prompt_text(f"rules/languages/{lang}", cwd)


def resolve_all(cwd: Path | None = None) -> str:
    """The rule texts of every configured language, in order, blank-line separated."""
    languages = load_settings(cwd).get("languages") or []
    parts = [resolve_language_rule(lang, cwd) for lang in languages]
    return "\n\n".join(part.rstrip() for part in parts if part)


def main() -> None:
    if len(sys.argv) > 2:
        print(f"{ERR_PREFIX} usage: inject-language-rules.py [<lang>]")
        sys.exit(0)
    try:
        content = resolve_language_rule(sys.argv[1]) if len(sys.argv) == 2 else resolve_all()
    except KernelSettingsError as error:
        print(error_line(error))
        sys.exit(0)
    except OSError as error:
        print(f"{ERR_PREFIX} {error}")
        sys.exit(0)
    if content:
        print(content, end="")
    sys.exit(0)


if __name__ == "__main__":
    main()
