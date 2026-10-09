---
type: llm
---

PASS if the final reply says /bdk:execute does not build a single part, names /bdk:implement-part add-csv-export 01 (or bdk:implement-part with add-csv-export 01) as the command that builds part 01, and names /bdk:execute add-csv-export as the command that builds the whole plan.
FAIL if the reply says the part or the plan was built, reports the stage as blocked, or does not name implement-part.
