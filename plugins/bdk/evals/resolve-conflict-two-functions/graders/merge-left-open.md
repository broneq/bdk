---
type: regex
target: { source: file, path: .git/MERGE_HEAD }
pattern: '^[0-9a-f]{40}'
---

The merge is still in progress: committing it is the lead's job.
