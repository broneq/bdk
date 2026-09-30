---
schema: 1
id: BDK-REACT-4
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Data fetching is declarative - Suspense + `use()`.** Read promises with `use()` inside components wrapped in a Suspense boundary. Co-locate fallback UI with the data dependency; do not invent loading flags in component state.
