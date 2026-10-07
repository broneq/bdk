---
kind: house
paths:
  - "**/*.jsx"
  - "**/*.tsx"
stages:
  - plan
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: languages/react.16.bade8d1b
  class: corrects the model
---

**Optimistic UI is local; Suspense is structural.** Keep `useOptimistic` inside the component that owns the mutation; let Suspense boundaries one level up handle genuine pending states. Mixing the two causes loading skeletons to flash during rollback.
