---
kind: house
paths:
  - "**/*.jsx"
  - "**/*.tsx"
stages:
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: languages/react.11.47cc2659
  class: effective
---

**State shape escalates with coupling, not size.** `useState` per independent value; `useReducer` when transitions are interdependent or form a small state machine; `useActionState` for form mutations (a reducer wired to an action). Line count is not the trigger - predictable state transitions are.
