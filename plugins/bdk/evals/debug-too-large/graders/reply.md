---
type: llm
---

PASS if the final reply names the root cause (`tally add` stores the amount as text), says the fix is too large for one plan part, and names `/bdk:design fix-total-crash` as the next step, without claiming anything was fixed.
FAIL if the reply says the bug was fixed, gives no root cause, or does not name `/bdk:design`.
