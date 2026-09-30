---
schema: 1
id: BDK-JS-4
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**`===` always; `==` never.** Loose equality coerces in ways that surprise (`0 == ""`, `null == undefined`) and hides type confusion. Use strict equality and convert types explicitly when you mean to.
