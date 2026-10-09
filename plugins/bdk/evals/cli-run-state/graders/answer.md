---
type: llm
---

PASS if the reply names the Changes add-total and add-count, says add-total is the current one, puts add-total at the close stage (its spec-conformance check not yet written) and add-count behind it, not started (stage propose), as `bdk run status` prints in the run.
FAIL if a stage or the current Change is guessed or differs from the `bdk run status` output.
