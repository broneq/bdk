---
schema: 1
id: BDK-DP-2
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Factory / Abstract Factory.** Centralise object construction when creation logic is complex, varies by context, or must be swapped in tests. Do not use for trivial `new` calls.
