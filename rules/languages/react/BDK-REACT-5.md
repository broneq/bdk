---
schema: 1
id: BDK-REACT-5
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

**State escalates only when shared.** Start with `useState` local. Promote to `Context` only for genuinely cross-cutting concerns (theme, auth, locale) where re-render impact is bounded. Reach for an external store when state is high-frequency, deeply shared, or has its own caching/refetch logic.
