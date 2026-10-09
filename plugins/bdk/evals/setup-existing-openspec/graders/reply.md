---
type: llm
---

PASS if the final reply does both: (1) names the removed `/.bdk/` rule of `.gitignore` in a line of its own, saying `.bdk/settings.yaml` is now tracked (or shared with the team); and (2) says the project keeps its `spec-driven` OpenSpec schema (or that switching to `bdk` was not done without asking) and that BDK opens its own Changes with the `bdk` schema.
FAIL if the reply does not mention the removed ignore rule, or says the default schema was switched to `bdk`.
