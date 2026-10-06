---
schema: 1
id: BDK-REACT-8
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

**Suspense + ErrorBoundary at meaningful granularity.** Pair each Suspense boundary with an ErrorBoundary so a single async failure does not blank the page. Use `onCaughtError` / `onUncaughtError` at the root to centralize observability.
