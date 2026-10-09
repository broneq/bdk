---
kind: house
paths:
  - "**/*.ts"
  - "**/*.mts"
  - "**/*.cts"
  - "**/*.tsx"
stages:
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: languages/typescript.13.fc7ffd88
  class: effective
---

**Avoid `enum`; reach for `as const` objects or unions.** Runtime `enum` emits real objects, has surprising reverse-mapping and `const enum` inlining pitfalls, and bloats bundles. An `as const` object or a string-literal union expresses the same finite set with clearer semantics and no runtime cost.
