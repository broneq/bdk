---
kind: house
paths:
  - "**/*.js"
  - "**/*.mjs"
  - "**/*.cjs"
  - "**/*.jsx"
stages:
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: languages/javascript.18.6205c1b3
  class: effective
---

**Treat untrusted keys as prototype-pollution vectors.** Deep-merging or assigning from attacker-controlled JSON lets `__proto__`/`constructor`/`prototype` keys mutate `Object.prototype` and poison every object. Use `Object.create(null)` or `Map` for untrusted data, reject those keys, and avoid known-vulnerable deep-merge utilities.
