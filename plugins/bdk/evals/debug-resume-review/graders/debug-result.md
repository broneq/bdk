---
type: regex
target: { source: file, path: .bdk/runs/fix-total-crash/debug/result.md }
pattern: '^Status: (?:done|blocked)[\s\S]*## Fix[\s\S]*red seen; green seen[\s\S]*## Review'
---

The result is written from the files: the Fix section carries the part report's acceptance test line.
