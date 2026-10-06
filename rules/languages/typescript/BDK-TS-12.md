---
schema: 1
id: BDK-TS-12
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

**`verbatimModuleSyntax` keeps import intent honest.** Without explicit `import type`, the compiler's elision heuristics can drop an import whose only purpose is a runtime side effect (polyfill, global registration) - or accidentally retain a type-only one. Enabling it makes runtime-vs-type imports explicit and prevents that silent class of bug.
