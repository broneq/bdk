---
type: llm
---

PASS if the run asks the user (in an AskUserQuestion call or in the final reply) to decide the findings of the round, offering for the findings the choices fix, accept and defer, with a recommended choice marked for each finding or group of findings.
FAIL if the run decides the findings without asking, or asks without offering choices or a recommendation.
