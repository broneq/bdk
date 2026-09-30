---
schema: 1
id: BDK-TQ-7
kind: house
severity: medium
origin: bdk
since: 2026-09-30
---

**Still allowed - generator and renderer output.** Asserting that a template renderer resolved a marker, or that a resolver selected the right branch, exercises real code even though the output is text. The bans on prose tests cover hand-written prose, not testing the code that produces text.
