---
schema: 1
id: BDK-REACT-7
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

**Semantic HTML first; ARIA only as repair.** Use `<button>`, `<nav>`, `<header>`, `<form>` and their native semantics before adding `role` / `aria-*`. ARIA enhances elements whose native semantics fall short - it does not substitute for them.
