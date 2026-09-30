---
schema: 1
id: BDK-ARCH-2
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Dependency Inversion (SOLID - DIP).** High-level policy does not depend on low-level detail; both depend on an abstraction owned by the high-level side. The domain layer defines the interface (e.g. `UserRepository`); infra implements it. This is what lets the dependency arrow point inward - a complement to BDK-ARCH-1 (dependency direction), not a restatement of it.
