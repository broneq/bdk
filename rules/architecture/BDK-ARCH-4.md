---
schema: 1
id: BDK-ARCH-4
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

**Premature abstraction.** Three concrete instances before extracting an abstraction. Two similar functions is fine; an interface for "future implementations" is not.
