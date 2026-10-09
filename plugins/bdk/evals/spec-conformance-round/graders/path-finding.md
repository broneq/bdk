---
type: llm
focus: { source: file, path: .bdk/runs/add-total/review/round-1/findings.jsonl }
---

PASS if a finding whose source is `spec-conformance` says that an absolute `TALLY_LEDGER` path is read under the current directory (the code joins it to `process.cwd()`), although the requirement Ledger file allows an absolute path.
FAIL if no `spec-conformance` finding names that path defect.
