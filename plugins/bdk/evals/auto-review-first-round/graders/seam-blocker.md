---
type: regex
target: { source: file, path: .bdk/runs/monthly-report/review/round-1/report.md }
pattern: '## blocker\n[\s\S]*?(src/report\.js|bin/ledger\.js)[\s\S]*?\n## should-fix'
---

The seam bug (cents formatted as currency units) is a blocker.
