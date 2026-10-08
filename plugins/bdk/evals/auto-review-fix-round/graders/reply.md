---
type: llm
---

PASS if the final reply reports the review of monthly-report after two rounds: the round 1 findings to fix were fixed (fix part 03), round 2 reviewed the fixes, and it gives the stage status (done, with `/bdk:close` as the next step, or blocked, naming what is left and why, such as a blocker found in round 2 with the round budget spent).
FAIL if the reply claims the review is done while it names a blocker left to fix, or does not say what happened in round 2.
