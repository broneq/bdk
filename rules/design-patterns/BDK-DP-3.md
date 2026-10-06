---
schema: 1
id: BDK-DP-3
kind: house
paths:
  - "**"
stages:
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Observer / Event.** Decouple producers from consumers when the producer should not know about its subscribers. Prefer over direct method calls when the subscriber set changes at runtime.
