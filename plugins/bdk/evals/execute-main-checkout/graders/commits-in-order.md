---
type: regex
target: { source: file, path: .git/logs/refs/heads/add-totals }
pattern: '\tcommit: [^\n]*[Pp]art 01[^\n]*\n[^\n]*\tcommit: [^\n]*[Pp]art 02[^\n]*\n[^\n]*\tcommit: [^\n]*[Pp]art 03'
---

The Change branch gains one commit per part, in part order, each right after the other: no merge commit between them.
