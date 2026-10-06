---
schema: 1
id: BDK-ARCH-1
kind: house
paths:
  - "**"
stages:
  - design
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Dependency direction.** No cycles. Layers (e.g. domain → infra) flow one way.
