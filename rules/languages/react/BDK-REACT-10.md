---
schema: 1
id: BDK-REACT-10
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**State shape escalates with coupling, not size.** `useState` per independent value; `useReducer` when transitions are interdependent or form a small state machine; `useActionState` for form mutations (a reducer wired to an action). Line count is not the trigger - predictable state transitions are.
