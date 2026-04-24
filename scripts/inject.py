#!/usr/bin/env python3
"""Conditional content injector for BDK skills and agents.

Evaluates conditions against .bdk/settings.json and prints file content
(or inline text) to stdout when all conditions are true. Silent when any
condition is false or settings file is missing.

Usage:
    python3 inject.py --if features.react --then path/to/react.md
    python3 inject.py --if features.react --if languages[typescript] --then react-ts.md
    python3 inject.py --if features.react --then-text "Prefer reducers over useState"
    python3 inject.py --if features.react --then file.md --settings /custom/.bdk/settings.json

Condition syntax:
    features.react              settings["features"]["react"] is True
    features.code-review-graph  settings["features"]["code-review-graph"] is True
    languages[typescript]       "typescript" in settings["languages"]

Multiple --if flags use AND logic (all must be true).

Public API (importable):
    from inject import load_settings, evaluate_condition, inject
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# Matches: features.some-key  OR  languages[value]
_FEATURE_RE = re.compile(r'^features\.([\w-]+)$')
_ARRAY_RE = re.compile(r'^([\w-]+)\[([\w-]+)\]$')


def load_settings(start: str | Path | None = None) -> dict | None:
    """Walk up from start (default: cwd) until .bdk/settings.json found.

    Returns parsed settings dict, or None if not found or unparseable.
    """
    current = Path(start).resolve() if start else Path.cwd()
    while True:
        candidate = current / ".bdk" / "settings.json"
        if candidate.exists():
            try:
                return json.loads(candidate.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return None
        parent = current.parent
        if parent == current:
            return None
        current = parent


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

    array_match = _ARRAY_RE.match(condition)
    if array_match:
        field, value = array_match.group(1), array_match.group(2)
        arr = settings.get(field)
        if not isinstance(arr, list):
            return False
        return value in arr

    raise ValueError(
        f"Unrecognised condition syntax: {condition!r}. "
        "Expected 'features.<key>' or '<field>[<value>]'."
    )


def inject(
    conditions: list[str],
    then_path: str | Path | None = None,
    then_text: str | None = None,
    settings: dict | None = None,  # type: ignore[type-arg]
) -> str:
    """Evaluate all conditions and return content string or empty string.

    Returns empty string when any condition is false or settings is None.
    Raises FileNotFoundError if then_path does not exist (conditions all true).
    Raises ValueError for invalid condition syntax.
    """
    if settings is None:
        return ""

    for condition in conditions:
        if not evaluate_condition(condition, settings):
            return ""

    if then_text is not None:
        return then_text

    if then_path is not None:
        path = Path(then_path)
        if not path.exists():
            raise FileNotFoundError(f"inject: file not found: {then_path}")
        return path.read_text(encoding="utf-8")

    return ""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Conditionally inject file content based on .bdk/settings.json"
    )
    parser.add_argument(
        "--if",
        dest="conditions",
        action="append",
        required=True,
        metavar="CONDITION",
        help="Condition to evaluate (repeatable, AND logic)",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--then", dest="then_path", metavar="FILE", help="File to print if conditions true")
    group.add_argument("--then-text", dest="then_text", metavar="TEXT", help="Inline text to print if conditions true")
    parser.add_argument(
        "--settings",
        dest="settings_path",
        metavar="PATH",
        help="Path to .bdk/settings.json (default: search upward from cwd)",
    )
    args = parser.parse_args()

    settings = (
        load_settings(args.settings_path)
        if args.settings_path
        else load_settings()
    )

    if settings is None:
        sys.exit(0)

    try:
        result = inject(
            conditions=args.conditions,
            then_path=args.then_path,
            then_text=args.then_text,
            settings=settings,
        )
    except ValueError as e:
        print(f"[BDK inject] {e}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"[BDK inject] {e}", file=sys.stderr)
        sys.exit(1)

    if result:
        print(result, end="")

    sys.exit(0)


if __name__ == "__main__":
    main()
