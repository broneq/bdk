---
type: llm
---

The spec asks for `ledger export <file> --out <path>`, but neither the specs nor the design say what happens when `<path>` already exists.

PASS if the final reply names that open choice (an existing output file: overwrite, refuse or similar) as a gap of the design that stops the plan, and names `/bdk:design add-csv-export` as the stage that answers it.
FAIL if the reply does not mention the existing output file, says the plan was verified or passed, names `/bdk:execute` as the next stage, or says the plan decided the behaviour for an existing file.
