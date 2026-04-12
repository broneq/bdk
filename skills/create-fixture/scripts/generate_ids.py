#!/usr/bin/env python3
"""Generate a fresh pool of UUIDs and timestamps for fixture creation.

Generates 10% more identifiers than requested to absorb LLM counting mistakes.

Usage:
    .venv/bin/python .claude/skills/create-fixture/scripts/generate_ids.py --spans=<N>
    .venv/bin/python .claude/skills/create-fixture/scripts/generate_ids.py --spans=<N> --smart-fields=<M>

Arguments:
    --spans=N        Number of tracked-change spans planned (required).
                     Pool will contain ceil(N * 1.1) UUIDs and timestamps.
    --smart-fields=M Number of smart-field <a> fills planned (optional).
                     Defaults to ceil(N / 4). Pool contains ceil(M * 1.1) entries.
"""

from __future__ import annotations

import math
import secrets
import sys
import time
import uuid


def _pool_size(requested: int) -> int:
    return math.ceil(requested * 1.1)


def _ms_timestamps(count: int) -> list[str]:
    base = int(time.time() * 1000)
    return [str(base + i * 1847 + secrets.randbelow(500)) for i in range(count)]


def _s_timestamps(count: int, base_ms: int) -> list[str]:
    base = base_ms // 1000
    return [str(base + i * 3 + secrets.randbelow(5)) for i in range(count)]


def _span_uuids(count: int) -> list[str]:
    return [str(uuid.uuid4()) for _ in range(count)]


def _smart_field_ids(count: int) -> list[str]:
    return [str(secrets.randbelow(9_000_000) + 100_000) for _ in range(count)]


def _parse_args(argv: list[str]) -> tuple[int, int | None]:
    spans: int | None = None
    smart_fields: int | None = None
    for arg in argv[1:]:
        if arg.startswith("--spans="):
            try:
                spans = int(arg.split("=", 1)[1])
            except ValueError:
                pass
        elif arg.startswith("--smart-fields="):
            try:
                smart_fields = int(arg.split("=", 1)[1])
            except ValueError:
                pass
    if spans is None:
        print("Error: --spans=N is required.", file=sys.stderr)
        sys.exit(1)
    if spans <= 0:
        print("Error: --spans must be a positive integer.", file=sys.stderr)
        sys.exit(1)
    return spans, smart_fields


def main() -> None:
    spans_requested, sf_requested = _parse_args(sys.argv)

    span_count = _pool_size(spans_requested)
    sf_count = _pool_size(
        sf_requested if sf_requested is not None else math.ceil(spans_requested / 4)
    )

    base_ms = int(time.time() * 1000)
    span_ts = _ms_timestamps(span_count)
    sf_ts = _s_timestamps(sf_count, base_ms)
    span_ids = _span_uuids(span_count)
    sf_ids = _smart_field_ids(sf_count)

    print("=" * 60)
    print("IDENTIFIER POOL")
    print("=" * 60)
    print(f"Planned spans: {spans_requested}  →  pool size: {span_count} (+10% buffer)")
    print(
        f"Planned smart-fields: {sf_requested if sf_requested is not None else 'auto'}  →  pool size: {sf_count} (+10% buffer)"
    )
    print()
    print("Span timestamps (13-digit ms) — use for <span> tracked changes:")
    for ts in span_ts:
        print(f"  {ts}")
    print()
    print('Smart-field timestamps (10-digit s) — use for <a name="smart-field"> only:')
    for ts in sf_ts:
        print(f"  {ts}")
    print()
    print("Span UUIDs — use for data-identifier on <span> elements:")
    for u in span_ids:
        print(f"  {u}")
    print()
    print("Smart-field IDs (numeric) — use for data-identifier on <a> smart fields:")
    for sf in sf_ids:
        print(f"  {sf}")
    print("=" * 60)


if __name__ == "__main__":
    main()
