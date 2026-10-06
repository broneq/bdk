---
schema: 1
id: BDK-JS-3
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

**Parallelize independent async work; await sequentially only when ordered.** `await`-in-a-loop over independent tasks serializes them needlessly - collect the promises and use `Promise.all` (fail-fast) or `Promise.allSettled` (when every outcome matters). Await in sequence only when one step truly depends on the previous.
