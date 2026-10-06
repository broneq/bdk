---
schema: 1
id: BDK-TS-8
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

**Generics serve readability, not cleverness.** Deeply nested conditional and recursive mapped types that are harder to read than the logic they guard are a liability - they wreck compile times and IDE responsiveness and lock the code to a TypeScript expert. Extract complex types, comment them, and ask whether a plain type would do.
