---
schema: 1
id: BDK-ARCH-3
kind: house
paths:
  - "**"
stages:
  - design
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**Interface Segregation (SOLID - ISP).** A client should not be forced to depend on methods it does not use. Prefer several small, role-specific interfaces over one fat interface that every consumer implements in full. A consumer that stubs half an interface with `raise NotImplementedError` is a sign the interface is over-broad - split it.
