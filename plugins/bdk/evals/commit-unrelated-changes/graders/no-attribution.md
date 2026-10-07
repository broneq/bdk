---
type: regex
target: { source: file, path: .git/COMMIT_EDITMSG }
pattern: 'Co-Authored-By|noreply@anthropic\.com'
flags: i
match: not_contains
---

The commit message carries no co-author trailer; the project's convention has none.
