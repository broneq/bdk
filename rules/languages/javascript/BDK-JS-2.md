---
schema: 1
id: BDK-JS-2
kind: house
paths:
  - "**/*.js"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.jsx"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**`async`/`await` over raw `.then` chains.** Awaited code reads top-to-bottom, produces usable stack traces, and makes `try/catch` the single error path. Reserve raw promise combinators for genuine concurrency, not sequential flow.
