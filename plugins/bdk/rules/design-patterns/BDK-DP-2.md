---
kind: house
paths:
  - "**"
stages:
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: design-patterns.03.2dad9824
  class: effective
---

**Factory / Abstract Factory.** Centralise object construction when creation logic is complex, varies by context, or must be swapped in tests. Do not use for trivial `new` calls.
