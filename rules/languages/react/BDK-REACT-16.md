---
schema: 1
id: BDK-REACT-16
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

**Server Action errors: return for recoverable, throw for fatal.** Returning an error object from an action keeps optimistic UI and form state intact; throwing triggers rollback and the nearest ErrorBoundary. The choice is UX, not style - pick deliberately.
