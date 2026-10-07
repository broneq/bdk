---
type: regex
target: { source: file, path: .git/COMMIT_EDITMSG }
pattern: '^(?=[^\n]{1,50}(?:\n|$))(?:add|change|fix|remove|docs|chore)\(billing\)!?: [a-z]'
---

A commit was made, and its header uses a type and scope the commitlint config allows, starts the subject in lower case and stays within 50 characters.
