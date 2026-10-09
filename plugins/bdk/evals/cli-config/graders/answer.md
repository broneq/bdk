---
type: llm
---

PASS if the reply says the test command is `npm test` (node-test) set in `.bdk/settings.yaml`, and gives a value for policy.budgets.review-rounds that it says is a default (not set in the project's settings). The value must be the one `bdk config show policy.budgets.review-rounds` prints in the run.
FAIL if the value is guessed, or is called project-set, or the test command is wrong.
