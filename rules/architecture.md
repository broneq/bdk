# Architecture Rules

Language-agnostic principles for module design and dependency management.

- **Module boundaries.** Each module has one clear purpose and a small, well-defined interface.
- **Dependency direction.** No cycles. Layers (e.g. domain → infra) flow one way.
- **Premature abstraction.** Three concrete instances before extracting an abstraction. Two similar functions is fine; an interface for "future implementations" is not.
- **Justified changes.** New abstractions and indirection serve current requirements, not speculative ones.
- **Single source of truth.** Same fact should not be expressed in two places that can drift.
