---
schema: 1
id: BDK-TS-2
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

**`unknown`, never `any`, at the edges.** `any` switches off the type checker and lets unsafe values flow silently through the program; `unknown` forces an explicit narrow before use. Use it for parsed JSON, API responses, and external input - `any` is a finding unless justified with a comment.
