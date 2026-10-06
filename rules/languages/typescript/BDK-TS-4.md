---
schema: 1
id: BDK-TS-4
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

**Model variants as discriminated unions.** Give each variant a shared literal tag (`type`/`kind`/`status`) so control-flow narrowing resolves the union precisely and exhaustiveness checks catch the missing case. Prefer this over inheritance or a bag of optional fields for any closed set of states.
