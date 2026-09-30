---
schema: 1
id: BDK-DP-8
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Replace conditional with polymorphism.** When a switch or if-chain dispatches on a type tag (`if kind == "pdf": ... elif kind == "xml": ...`), push branches into subclasses or a Strategy. New cases extend code, not edit it.
