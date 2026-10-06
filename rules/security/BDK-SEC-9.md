---
schema: 1
id: BDK-SEC-9
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

**Dependency hygiene.** Treat third-party packages as attack surface. Pin versions, prefer maintained libraries over hand-rolled crypto/parsers, and remove unused dependencies - each one is code you did not write but ship.
