---
type: llm
---

PASS if the final reply reports the review outcome of the fix Change fix-total-crash and names `/bdk:close fix-total-crash` as the next step, or, when the review left a blocker, names that blocker with its command; it may restate the root cause and the reproduction test from the earlier run.
FAIL if the reply says it diagnosed or rebuilt the fix in this run, gives no review outcome, or names no next step.
