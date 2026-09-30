---
schema: 1
id: BDK-PL-2
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**No placeholders in executable fields.** Commands, file paths, test names and code in a plan are written out in full. A `<TBD>`, `...` or "similar to above" in a field an agent executes becomes a guess at run time.
