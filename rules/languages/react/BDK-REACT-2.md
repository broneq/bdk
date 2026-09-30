---
schema: 1
id: BDK-REACT-2
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Trust the React Compiler - drop manual memoization.** Avoid `useMemo`, `useCallback`, `React.memo` unless a measured regression or a third-party reference-equality contract requires them. Hand-rolled memoization fights the compiler and rots fast.
