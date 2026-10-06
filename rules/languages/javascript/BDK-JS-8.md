---
schema: 1
id: BDK-JS-8
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

**Treat untrusted keys as prototype-pollution vectors.** Deep-merging or assigning from attacker-controlled JSON lets `__proto__`/`constructor`/`prototype` keys mutate `Object.prototype` and poison every object. Use `Object.create(null)` or `Map` for untrusted data, reject those keys, and avoid known-vulnerable deep-merge utilities.
