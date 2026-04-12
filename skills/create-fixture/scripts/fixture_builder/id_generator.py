"""Generate unique IDs, timestamps, and counters for fixture tracked changes."""

from __future__ import annotations

import secrets
import time
import uuid


class IDGenerator:
    """Generate unique IDs, timestamps, and counters for fixture tracked changes."""

    def __init__(self) -> None:
        self._base_ms = int(time.time() * 1000)
        self._ms_counter = 0
        self._s_counter = 0
        self._cid = 0
        self._cts = 0

    def next_timestamp_ms(self) -> int:
        """13-digit millisecond timestamp (for SEA + Froala spans)."""
        ts = self._base_ms + self._ms_counter * 1847 + secrets.randbelow(500)
        self._ms_counter += 1
        return ts

    def next_timestamp_s(self) -> int:
        """10-digit second timestamp (for Froala smart fields)."""
        base_s = self._base_ms // 1000
        ts = base_s + self._s_counter * 3 + secrets.randbelow(5)
        self._s_counter += 1
        return ts

    def next_uuid(self) -> str:
        """UUID v4 string (for Froala data-identifier)."""
        return str(uuid.uuid4())

    def next_cid(self) -> int:
        """Sequential CID (for SEA data-cid, shared del+ins pair)."""
        self._cid += 1
        return self._cid

    def next_cts(self) -> int:
        """Sequential CTS (for SEA ice-cts-N class)."""
        self._cts += 1
        return self._cts
