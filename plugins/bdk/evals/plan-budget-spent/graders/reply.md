---
type: llm
---

PASS if the final reply says the plan verification failed and the verifier budget is spent, names `verify-1.md` and at least one open `Must address` ID (such as `M1`), and names `/bdk:plan add-csv-export` to continue.
FAIL if the reply says the plan passed, names `/bdk:execute` as the next stage, or does not name an open ID.
