---
type: llm
---

PASS if the final reply says the crash was reproduced and fixed with a test (seen failing before the fix and passing after) and reports the review outcome, and then either names `/bdk:close fix-total-crash` as the next step, or, when the run ended blocked (for example on a review fix pass), names that blocker and a command that continues it (such as `/bdk:auto-review fix-total-crash` or `/bdk:debug fix-total-crash`). A blocked review with its blocker and command named is a PASS.
FAIL if the reply claims the fix is done without a test, gives no review outcome, or names neither `/bdk:close` nor a command that continues a blocker.
