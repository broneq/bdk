"""Unit tests for IDGenerator — plain assert, runs standalone with python3."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts", "fixture_builder"))
from id_generator import IDGenerator


def test_next_timestamp_ms_returns_13_digits() -> None:
    ids = IDGenerator()
    ts = ids.next_timestamp_ms()
    assert isinstance(ts, int), f"Expected int, got {type(ts)}"
    assert len(str(ts)) == 13, f"Expected 13 digits, got {len(str(ts))}: {ts}"


def test_next_timestamp_ms_increases() -> None:
    ids = IDGenerator()
    t1 = ids.next_timestamp_ms()
    t2 = ids.next_timestamp_ms()
    assert t2 > t1, f"Expected {t2} > {t1}"


def test_next_timestamp_s_returns_10_digits() -> None:
    ids = IDGenerator()
    ts = ids.next_timestamp_s()
    assert isinstance(ts, int), f"Expected int, got {type(ts)}"
    assert len(str(ts)) == 10, f"Expected 10 digits, got {len(str(ts))}: {ts}"


def test_next_uuid_is_valid_format() -> None:
    import re

    ids = IDGenerator()
    u = ids.next_uuid()
    pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    assert re.match(pattern, u), f"Invalid UUID format: {u}"


def test_next_uuid_unique() -> None:
    ids = IDGenerator()
    u1 = ids.next_uuid()
    u2 = ids.next_uuid()
    assert u1 != u2, f"UUIDs should be unique: {u1} == {u2}"


def test_next_cid_sequential() -> None:
    ids = IDGenerator()
    assert ids.next_cid() == 1
    assert ids.next_cid() == 2
    assert ids.next_cid() == 3


def test_next_cts_sequential() -> None:
    ids = IDGenerator()
    assert ids.next_cts() == 1
    assert ids.next_cts() == 2


if __name__ == "__main__":
    test_next_timestamp_ms_returns_13_digits()
    test_next_timestamp_ms_increases()
    test_next_timestamp_s_returns_10_digits()
    test_next_uuid_is_valid_format()
    test_next_uuid_unique()
    test_next_cid_sequential()
    test_next_cts_sequential()
    print("All IDGenerator tests passed!")
