---
schema: 1
id: BDK-REACT-17
kind: house
paths:
  - "**/*.jsx"
  - "**/*.tsx"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Context for environment, store for hot state.** Context fits stable, low-frequency values (theme, auth, locale). High-frequency or fan-out state (cursor position, page index, large derived lists) belongs in an external store even with the Compiler - Context still re-renders every consumer.
