---
type: llm
---

PASS if the final reply names a Change whose name starts with `v3-42-` and `/bdk:design v3-42-<slug>` (with the actual name) as the next step.
FAIL if the Change it names starts with `42-` or the reply names no next step.
