---
schema: 1
id: BDK-TS-9
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

**Template literal types for known, finite string sets only.** They shine on route patterns, event names, and CSS-class conventions where the set is static and small. Large interpolated unions explode compile time; pair any externally-sourced string with runtime validation regardless.
