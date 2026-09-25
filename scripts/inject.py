#!/usr/bin/env python3
"""Conditional content injector for BDK skills and agents.

Evaluates conditions against the resolved settings (every layer merged,
defaults included, read through the kernel by scripts/kernel_settings.py) and
prints file content (or inline text) to stdout when all conditions are true.
Silent when any condition is false.

Usage:
    python3 inject.py --if features.lavish --then path/to/lavish.md
    python3 inject.py --if features.lavish --if languages[typescript] --then file.md
    python3 inject.py --if languages[react] --then-text "Prefer reducers over useState"
    python3 inject.py --if languages[react] --prefer languages[vue] --then react.md

Condition syntax:
    features.react              settings["features"]["react"] is True
    languages[typescript]       "typescript" in settings["languages"]
    tool.lavish-axi             an executable named "lavish-axi" is on PATH

Multiple --if flags use AND logic (all must be true).

The dotted spelling of ``tool.`` is mandatory. ``tool[name]`` would be parsed by
the array rule as a lookup in a nonexistent ``tool`` list and silently evaluate
false, which is exactly the kind of quiet wrong answer this script must not give.

Failures (unknown condition, missing file, bad arguments, a kernel refusal or
a missing Node) print
``[bdk-inject-error] <description>`` to **stdout** and exit 0. Stdout, because a
``!`...`` `` block in a skill body captures stdout only - anything on stderr is
invisible in the rendered skill and the failure reads as an empty condition. Exit
0, because a nonzero exit from a skill-body injection is not surfaced either.
A *false* condition is legitimately silent; a *broken* one never is.

Public API (importable):
    from inject import load_settings, evaluate_condition, inject
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kernel_settings import KernelSettingsError, error_line, load_settings  # noqa: E402

__all__ = ["KernelSettingsError", "evaluate_condition", "inject", "load_settings"]

# Matches: features.some-key  OR  tool.some-binary  OR  languages[value]
_FEATURE_RE = re.compile(r'^features\.([\w-]+)$')
_TOOL_RE = re.compile(r'^tool\.([\w.-]+)$')
_ARRAY_RE = re.compile(r'^([\w-]+)\[([\w-]+)\]$')

ERR_PREFIX = "[bdk-inject-error]"


def evaluate_condition(condition: str, settings: dict) -> bool:  # type: ignore[type-arg]
    """Evaluate a single condition string against settings.

    Raises ValueError for unrecognised syntax.
    """
    feature_match = _FEATURE_RE.match(condition)
    if feature_match:
        key = feature_match.group(1)
        features = settings.get("features")
        if not isinstance(features, dict):
            return False
        return bool(features.get(key, False))

    tool_match = _TOOL_RE.match(condition)
    if tool_match:
        # Probes PATH, not settings: a feature flag says the user wants the
        # tool, this says the machine actually has it. Both must hold, so
        # callers pair `features.x` with `tool.x-binary`.
        return shutil.which(tool_match.group(1)) is not None

    array_match = _ARRAY_RE.match(condition)
    if array_match:
        field, value = array_match.group(1), array_match.group(2)
        arr = settings.get(field)
        if not isinstance(arr, list):
            return False
        return value in arr

    raise ValueError(
        f"Unrecognised condition syntax: {condition!r}. "
        "Expected 'features.<key>', 'tool.<binary>', or '<field>[<value>]'."
    )


def inject(
    conditions: list[str],
    prefer_conditions: list[str] | None = None,
    then_path: str | Path | None = None,
    then_text: str | None = None,
    settings: dict | None = None,  # type: ignore[type-arg]
) -> str:
    """Evaluate all conditions and return content string or empty string.

    prefer_conditions: list of conditions using OR logic — if any is true,
    suppress this block (used to defer to a higher-tier tool).
    Returns empty string when any condition is false, any prefer is true,
    or settings is None.
    """
    if settings is None:
        return ""

    for condition in conditions:
        if not evaluate_condition(condition, settings):
            return ""

    for prefer in (prefer_conditions or []):
        if evaluate_condition(prefer, settings):
            return ""

    if then_text is not None:
        return then_text

    if then_path is not None:
        path = Path(then_path)
        if not path.exists():
            raise FileNotFoundError(f"inject: file not found: {then_path}")
        return path.read_text(encoding="utf-8")

    return ""


class _StdoutArgumentParser(argparse.ArgumentParser):
    """Report argument errors on stdout with exit 0, like every other failure.

    argparse's default (stderr, exit 2) renders as an empty `!` block, so a
    stale call to a flag that no longer exists would look like a false
    condition instead of a broken one.
    """

    def error(self, message: str) -> None:  # type: ignore[override]
        print(f"{ERR_PREFIX} inject: {message}")
        sys.exit(0)


def main() -> None:
    parser = _StdoutArgumentParser(
        description="Conditionally inject file content based on the BDK settings"
    )
    parser.add_argument(
        "--if",
        dest="conditions",
        action="append",
        required=False,
        default=[],
        metavar="CONDITION",
        help="Condition to evaluate (repeatable, AND logic)",
    )
    parser.add_argument(
        "--prefer",
        dest="prefer_conditions",
        action="append",
        default=[],
        metavar="CONDITION",
        help="Suppress block if any of these conditions are true (repeatable, OR logic)",
    )
    group = parser.add_mutually_exclusive_group(required=False)
    group.add_argument("--then", dest="then_path", metavar="FILE", help="File to print if conditions true")
    group.add_argument("--then-text", dest="then_text", metavar="TEXT", help="Inline text to print if conditions true")
    args = parser.parse_args()

    if not args.conditions and not args.prefer_conditions:
        parser.error("one of --if or --prefer is required")
    if args.then_path is None and args.then_text is None:
        parser.error("one of the arguments --then --then-text is required")

    try:
        settings = load_settings()
    except KernelSettingsError as error:
        print(error_line(error))
        sys.exit(0)

    try:
        result = inject(
            conditions=args.conditions,
            prefer_conditions=args.prefer_conditions,
            then_path=args.then_path,
            then_text=args.then_text,
            settings=settings,
        )
    except (ValueError, FileNotFoundError) as e:
        print(f"{ERR_PREFIX} {e}")
        sys.exit(0)

    if result:
        print(result, end="")
    sys.exit(0)


if __name__ == "__main__":
    main()
