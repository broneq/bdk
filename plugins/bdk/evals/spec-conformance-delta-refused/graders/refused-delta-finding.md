---
type: llm
focus: { source: file, path: .bdk/runs/add-total/review/round-1/findings.jsonl }
---

PASS if a finding whose source is `spec-conformance` has the file `openspec/changes/add-total/specs/tally/spec.md` and says that the requirement Bad amount has no scenario (OpenSpec refuses it, `openspec validate --strict` fails, or archive cannot merge the delta).
FAIL if no `spec-conformance` finding on that file names the missing scenario of Bad amount.
