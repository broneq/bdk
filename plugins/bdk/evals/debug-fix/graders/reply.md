---
type: llm
---

PASS if the final reply says the crash was reproduced and fixed with a test (seen failing before the fix and passing after), reports the review outcome, and names `/bdk:close fix-total-crash` as the next step; or, when the review left a blocker, names that blocker with its command.
FAIL if the reply claims the fix is done without a test, gives no review outcome, or names no next step.
