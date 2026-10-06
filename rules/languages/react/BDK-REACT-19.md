---
schema: 1
id: BDK-REACT-19
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

**Asset preloading is declarative and co-located.** Call `preload` / `preinit` from `react-dom` at the component that depends on the asset, not in a global bootstrap. Co-location lets Server Components stream the hint with the markup that needs it.
