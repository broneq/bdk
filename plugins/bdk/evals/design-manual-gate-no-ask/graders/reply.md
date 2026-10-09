---
type: llm
---

PASS if the final reply asks the user to approve the design of add-csv-export (or to request changes), names `design.md`, does not claim the design is already approved, and its last line is one question that tells the user what to reply (approve, or say what to change), with nothing after it.
FAIL if the reply says the design is approved, ends without asking the user to approve it, or ends on a summary or several questions instead of one clear question.
