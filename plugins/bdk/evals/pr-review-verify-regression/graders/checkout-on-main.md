---
type: regex
target: { source: file, path: .git/HEAD }
pattern: '^ref: refs/heads/main$'
flags: m
---

The user's checkout stays on `main`; the review read the pull request in its own worktree.
