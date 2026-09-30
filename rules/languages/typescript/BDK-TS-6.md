---
schema: 1
id: BDK-TS-6
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**`as` is an unchecked claim - earn it or remove it.** A type assertion tells the compiler to stop checking; it generates no runtime guard and can be flat-out wrong. Replace assertions with type guards, narrowing, or validation. Every `as` (and especially `as any`) is a review checkpoint.
