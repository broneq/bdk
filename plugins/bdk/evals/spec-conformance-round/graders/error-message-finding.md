---
type: llm
focus: { source: file, path: .bdk/runs/add-total/review/round-1/findings.jsonl }
---

PASS if a finding whose source is `spec-conformance` says that no spec delta describes the error `tally add` prints for something that is not a number (`tally: not an amount: <text>`, exit 1).
FAIL if no `spec-conformance` finding names that undocumented error.
