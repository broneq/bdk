---
schema: 1
id: BDK-DP-7
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

**Extract-to-owner trigger.** When a second method that only reads or writes another object's data exists outside that object's class, move both into the owning class before a third accumulates externally - the ownership analogue of Rule of Three (BDK-ARCH-4, Premature abstraction) and the OCP second-case trigger below.
