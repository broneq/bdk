---
type: llm
---

PASS if the reply says the cause is `line.qty || 1`, which treats a quantity of 0 as missing because 0 is falsy, and that the fix tells a missing quantity apart from 0 (for example `??` or an explicit check).
FAIL if it names a different cause.
