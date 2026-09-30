---
schema: 1
id: BDK-SEC-3
kind: house
severity: high
origin: bdk
since: 2026-09-30
---

**Output encoding.** Encode data for the context it lands in (HTML body, attribute, URL, JS, log line) at the point of output, not at input. The same value is safe in one sink and dangerous in another; encode per-sink.
