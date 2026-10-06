---
schema: 1
id: BDK-TS-5
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

**`satisfies` for config and literals - not `as`.** `satisfies` checks an expression against a type _without widening_ it, keeping the narrow inferred type while still validating shape. Reach for it before an annotation (which widens) and far before an assertion (which lies). Use `const` type parameters to preserve literals through generics instead of sprinkling `as const`.
