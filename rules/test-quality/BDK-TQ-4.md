---
schema: 1
id: BDK-TQ-4
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

**Banned - introspection smoke tests.** Asserting that a symbol exists, is callable, or that a module loads verifies the language, not the code.
