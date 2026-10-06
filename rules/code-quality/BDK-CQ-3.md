---
schema: 1
id: BDK-CQ-3
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

**Single Responsibility (SOLID - SRP).** A class or module has one reason to change. When a unit serves two unrelated stakeholders (persistence + formatting, parsing + transport), a change for one risks breaking the other - split it. Scales BDK-CQ-2 (function size) up to the class/module level.
