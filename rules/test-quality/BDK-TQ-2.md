---
schema: 1
id: BDK-TQ-2
kind: house
paths:
  - "**"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Banned - constant mirrors.** Asserting that a constant equals its own definition catches nothing: any change edits both sides at once. If the value matters, assert the behavior that depends on it.
