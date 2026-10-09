---
type: regex
target: { source: file, path: .bdk/runs/add-total/e2e/verdict.md }
flags: im
pattern: '^- fail: [^\n]*(empty|nothing|no-ledger|fresh|first|before)[^\n]*proposal\.md:(3|7)\b'
---
