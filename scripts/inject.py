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
    python3 inject.py --if features.serena --prefer features.code-review-graph --then serena.md
    python3 inject.py --chain fragments/tool-tiers/search.chain.json

Condition syntax:
    features.react              settings["features"]["react"] is True
    features.code-review-graph  settings["features"]["code-review-graph"] is True
    languages[typescript]       "typescript" in settings["languages"]
    tool.lavish-axi             an executable named "lavish-axi" is on PATH

Multiple --if flags use AND logic (all must be true).

The dotted spelling of ``tool.`` is mandatory. ``tool[name]`` would be parsed by
the array rule as a lookup in a nonexistent ``tool`` list and silently evaluate
false, which is exactly the kind of quiet wrong answer this script must not give.

Failures (unknown condition, missing file, bad chain) print
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
import json
import re
import shutil
import sys
from pathlib import Path

# Matches: features.some-key  OR  tool.some-binary  OR  languages[value]
_FEATURE_RE = re.compile(r'^features\.([\w-]+)$')
_TOOL_RE = re.compile(r'^tool\.([\w.-]+)$')
_ARRAY_RE = re.compile(r'^([\w-]+)\[([\w-]+)\]$')

ERR_PREFIX = "[bdk-inject-error]"


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


def inject_chain(
    chain_path: str | Path,
    settings: dict | None = None,
) -> str:
    """Resolve a chain config file and return assembled content.

    Chain file format:
        {"mode": "exclusive"|"additive", "header": "header.md", "chain": [...]}

    Each chain entry:
        {"if": ["condition", ...], "then": "relative/path.md"}
        {"prefer": ["condition", ...], "then": "fallback.md"}
        {"then": "path.md"}  # unconditional fallback

    ``prefer`` uses OR logic and *suppresses* the entry when any of its
    conditions is true. In ``additive`` mode a plain unconditional entry always
    injects, so a fallback tier there must guard itself with ``prefer`` listing
    every higher tier it defers to.

    The optional ``header`` is prepended to the result whenever at least one
    chain entry produced content. Paths in chain entries and ``header`` are
    resolved relative to ``chain_path``'s directory.

    Returns empty string when settings is None or no chain entry matched.
    Raises FileNotFoundError if chain_path or referenced files do not exist.
    Raises ValueError for unrecognised mode or missing 'then'.
    """
    if settings is None:
        return ""

    chain_path = Path(chain_path)
    if not chain_path.exists():
        raise FileNotFoundError(f"inject: chain file not found: {chain_path}")

    try:
        config = json.loads(chain_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"inject: invalid JSON in chain file {chain_path}: {e}") from e

    mode = config.get("mode")
    if mode not in ("exclusive", "additive"):
        raise ValueError(f"inject: unknown chain mode {mode!r} in {chain_path}")

    chain = config.get("chain", [])
    base = chain_path.parent
    parts: list[str] = []

    for entry in chain:
        conditions = entry.get("if", [])
        prefer = entry.get("prefer", [])
        then_rel = entry.get("then")
        if then_rel is None:
            raise ValueError(f"inject: chain entry missing 'then' key in {chain_path}")

        then_path = base / then_rel if not Path(then_rel).is_absolute() else Path(then_rel)
        content = inject(
            conditions=conditions,
            prefer_conditions=prefer,
            then_path=then_path,
            settings=settings,
        )

        if content:
            parts.append(content)
            if mode == "exclusive":
                break

    if not parts:
        return ""

    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Conditionally inject file content based on .bdk/settings.json"
    )
    parser.add_argument(
        "--chain",
        dest="chain_path",
        metavar="CHAIN_FILE",
        help="JSON chain config file for multi-tier injection",
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
    parser.add_argument(
        "--settings",
        dest="settings_path",
        metavar="PATH",
        help="Path to .bdk/settings.json (default: search upward from cwd)",
    )
    args = parser.parse_args()

    # Chain mode — mutually exclusive with --if/--then/--then-text
    if args.chain_path:
        # Validate chain file existence before loading settings
        if not Path(args.chain_path).exists():
            print(f"{ERR_PREFIX} inject: chain file not found: {args.chain_path}")
            sys.exit(0)
        settings = (
            load_settings(args.settings_path) if args.settings_path else load_settings()
        )
        if settings is None:
            sys.exit(0)
        try:
            result = inject_chain(chain_path=args.chain_path, settings=settings)
        except (FileNotFoundError, ValueError) as e:
            print(f"{ERR_PREFIX} {e}")
            sys.exit(0)
        if result:
            print(result, end="")
        sys.exit(0)

    # Standard --if/--then mode
    if not args.conditions and not args.prefer_conditions:
        parser.error("one of --if, --prefer, or --chain is required")
    if args.then_path is None and args.then_text is None:
        parser.error("one of the arguments --then --then-text is required")

    settings = (
        load_settings(args.settings_path) if args.settings_path else load_settings()
    )
    if settings is None:
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
