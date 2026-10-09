---
kind: knowledge
paths:
  - "**/*.jsx"
  - "**/*.tsx"
stages:
  - execute
  - review
source: "https://react.dev/blog/2024/12/05/react-19"
verified: 2026-09-30
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: languages/react.10.b94cb0a5
  class: effective
---

**`ref` is a prop in React 19.** Function components accept `ref` directly - `forwardRef` is no longer needed. Use the cleanup function of the ref callback or surrounding `useEffect` to release resources on unmount.
