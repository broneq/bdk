---
schema: 1
id: BDK-TQ-11
kind: house
paths:
  - "**"
stages:
  - plan
  - execute
  - review
severity: medium
origin: bdk
since: 2026-09-30
---

**When the honest answer is no test, declare it.** If a change is non-executable content and the only test anyone could write is on the banned list, say so and rely on review. Padding a change with a test that cannot fail is worse than an explicitly untested change, because it hides the gap.
