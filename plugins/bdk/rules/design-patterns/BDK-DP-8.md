---
kind: house
paths:
  - "**"
stages:
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: design-patterns.09.5f5e9bf0
  class: effective
---

**Replace conditional with polymorphism.** When a switch or if-chain dispatches on a type tag (`if kind == "pdf": ... elif kind == "xml": ...`), push branches into subclasses or a Strategy. New cases extend code, not edit it.
