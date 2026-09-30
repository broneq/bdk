---
schema: 1
id: BDK-REACT-3
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Forms go through Actions.** Use server/form actions with `useActionState`, `useFormStatus`, and `useOptimistic` instead of hand-rolled pending/error state. Less code, less drift between UI and request lifecycle.
