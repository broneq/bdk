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
  bullet: languages/react.20.0477adec
  class: corrects the model
---

**Asset preloading is declarative and co-located.** Call `preload` / `preinit` from `react-dom` at the component that depends on the asset, not in a global bootstrap. Co-location lets Server Components stream the hint with the markup that needs it.
