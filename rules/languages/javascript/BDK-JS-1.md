---
schema: 1
id: BDK-JS-1
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

**ESM with named exports is the baseline.** Default new code to `"type": "module"` and `import`/`export`; CommonJS adds interop friction and blocks modern tooling. Prefer named exports over a default - they survive refactors and tree-shake cleanly.
