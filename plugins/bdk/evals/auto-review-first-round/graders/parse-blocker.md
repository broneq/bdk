---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/review.md }
pattern: '## blocker\n[\s\S]*?src/parse\.js[\s\S]*?\n## should-fix'
---

The parse bug (amounts with fewer than two decimals) is a blocker.
