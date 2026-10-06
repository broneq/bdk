---
schema: 1
id: BDK-SEC-7
kind: house
paths:
  - "**"
stages:
  - design
  - execute
  - review
severity: high
origin: bdk
since: 2026-09-30
---

**Fail closed.** On error, ambiguity, or a missing check, deny access rather than allow it. An auth check that throws must block the action, not fall through to the success path.
