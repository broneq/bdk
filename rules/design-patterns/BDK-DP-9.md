---
schema: 1
id: BDK-DP-9
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

**Open/Closed (SOLID - OCP).** Modules are open for extension, closed for modification. Adding a behaviour should mean adding code (a new subclass, strategy, or handler), not editing a central switch every existing caller depends on. BDK-DP-8 (replace conditional with polymorphism) is OCP in practice; reach for it only once a second case actually appears, not speculatively.
