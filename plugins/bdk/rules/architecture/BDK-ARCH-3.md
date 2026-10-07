---
kind: house
paths:
  - "**"
stages:
  - design
  - plan
  - execute
  - review
measured:
  report: docs/v3-draft1/evals/V3-EVAL-RULES-NOOP.md
  bullet: architecture.04.26099829
  class: effective
---

**Interface Segregation (SOLID - ISP).** A client should not be forced to depend on methods it does not use. Prefer several small, role-specific interfaces over one fat interface that every consumer implements in full. A consumer that stubs half an interface with `raise NotImplementedError` is a sign the interface is over-broad - split it.
