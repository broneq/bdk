---
schema: 1
id: BDK-TS-10
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

**Configure modules for your bundler.** With a modern bundler set `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, and `isolatedModules: true` so imports behave as written, type-only imports stay erasable, and per-file transpilers (esbuild, swc) don't choke. TypeScript 7's native compiler is a drop-in performance upgrade - no semantic changes, so the same config carries over.
