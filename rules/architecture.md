# Architecture Rules

Language-agnostic principles for module design and dependency management.

- **Module boundaries.** Each module has one clear purpose and a small, well-defined interface.
- **Dependency direction.** No cycles. Layers (e.g. domain → infra) flow one way.
- **Dependency Inversion (SOLID — DIP).** High-level policy does not depend on low-level detail; both depend on an abstraction owned by the high-level side. The domain layer defines the interface (e.g. `UserRepository`); infra implements it. This is what lets the dependency arrow point inward — a complement to the direction rule above, not a restatement of it.
- **Interface Segregation (SOLID — ISP).** A client should not be forced to depend on methods it does not use. Prefer several small, role-specific interfaces over one fat interface that every consumer implements in full. A consumer that stubs half an interface with `raise NotImplementedError` is a sign the interface is over-broad — split it.
- **Premature abstraction.** Three concrete instances before extracting an abstraction. Two similar functions is fine; an interface for "future implementations" is not.
- **Justified changes.** New abstractions and indirection serve current requirements, not speculative ones.
- **Single source of truth.** Same fact should not be expressed in two places that can drift.
