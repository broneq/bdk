---
schema: 1
id: BDK-REACT-9
kind: knowledge
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
source: "https://react.dev/blog/2024/12/05/react-19"
verified: 2026-09-30
---

**`ref` is a prop in React 19.** Function components accept `ref` directly - `forwardRef` is no longer needed. Use the cleanup function of the ref callback or surrounding `useEffect` to release resources on unmount.
