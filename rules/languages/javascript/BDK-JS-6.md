---
schema: 1
id: BDK-JS-6
kind: knowledge
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
source: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy"
verified: 2026-09-30
---

**Reach for the modern stdlib instead of hand-rolling.** `Object.groupBy`/`Map.groupBy` replace reduce-based grouping, `Array.prototype.at` handles negative indexing, logical-assignment operators (`??=`, `&&=`, `||=`) tidy defaults, and iterator helpers (`.map`/`.filter`/`.take` on iterators) process large or infinite sequences lazily without materializing intermediates. Native paths are clearer and faster than utility-library equivalents.
