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
  bullet: languages/react.02.770dd87f
  class: effective
---

**Trust the React Compiler - drop manual memoization.** Avoid `useMemo`, `useCallback`, `React.memo` unless a measured regression or a third-party reference-equality contract requires them. Hand-rolled memoization fights the compiler and rots fast.
