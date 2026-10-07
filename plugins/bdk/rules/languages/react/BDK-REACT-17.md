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
  bullet: languages/react.18.5d6ea2fe
  class: effective
---

**Context for environment, store for hot state.** Context fits stable, low-frequency values (theme, auth, locale). High-frequency or fan-out state (cursor position, page index, large derived lists) belongs in an external store even with the Compiler - Context still re-renders every consumer.
