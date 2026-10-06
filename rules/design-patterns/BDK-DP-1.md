---
schema: 1
id: BDK-DP-1
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

**Strategy.** Extract varying behaviour into a collaborator when the same algorithm is selected at runtime. Prefer over conditionals that grow with each new case.
