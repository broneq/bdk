---
schema: 1
id: BDK-REACT-12
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

**Cap cohesive props around five; flag boolean explosion.** Multiple booleans (`isLoading`, `isError`, `isDisabled`, `isRounded`) encode an exponential state space - collapse to a variant discriminant (`status: 'idle' | 'loading' | 'error'`). Beyond five props, prefer composition (`children`, slots) or a single config object over more positional flags.
