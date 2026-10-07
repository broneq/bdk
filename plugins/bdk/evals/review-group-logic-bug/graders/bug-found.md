---
type: llm
focus: { source: file, path: .bdk/runs/monthly-report/review/round-1/findings.jsonl }
---

PASS if at least one finding says that amounts with fewer than two decimal digits (such as `7` or `12.5`) are parsed into the wrong number of cents, or that dropping the decimal point is wrong.
FAIL if no finding names that problem, or the file is empty or missing.
