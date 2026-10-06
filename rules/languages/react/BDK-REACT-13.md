---
schema: 1
id: BDK-REACT-13
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

**Extract custom hooks for reuse or for local readability - place by scope.** Reusable hooks live in a shared hooks directory; single-component helpers live alongside the component. Readability-driven extraction is fine when the hook carries real logic (Effects, state machines, derived data). Avoid no-op wrappers like `useMount` or one-line `useState` aliases - they hide dependency bugs without buying anything.
