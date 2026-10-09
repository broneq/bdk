---
type: llm
focus: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
---

PASS if at least one finding on `src/parse.test.js` says that its tests are not grouped in a `describe` block named after `parseEntries`, as the project's `CLAUDE.md` asks.
FAIL if no finding names that problem, or the file is empty or missing.
