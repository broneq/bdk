---
schema: 1
id: BDK-TQ-5
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

**Banned - type-declaration mirrors.** Asserting a value's type where the signature already declares it duplicates the type checker and fails only where the type checker would have failed first.
