---
schema: 1
id: BDK-TS-7
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Avoid `enum`; reach for `as const` objects or unions.** Runtime `enum` emits real objects, has surprising reverse-mapping and `const enum` inlining pitfalls, and bloats bundles. An `as const` object or a string-literal union expresses the same finite set with clearer semantics and no runtime cost.
