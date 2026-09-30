---
schema: 1
id: BDK-REACT-15
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Optimistic UI is local; Suspense is structural.** Keep `useOptimistic` inside the component that owns the mutation; let Suspense boundaries one level up handle genuine pending states. Mixing the two causes loading skeletons to flash during rollback.
