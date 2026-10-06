---
schema: 1
id: BDK-TS-1
kind: house
paths:
  - "**/*.ts"
  - "**/*.mts"
  - "**/*.cts"
  - "**/*.tsx"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Turn on the checks `strict` leaves out.** `noUncheckedIndexedAccess` (index access yields `T | undefined`) and `exactOptionalPropertyTypes` (optional ≠ implicitly `undefined`) catch a whole class of null/optional bugs that the `strict` bundle alone misses. Enable both in production code.
