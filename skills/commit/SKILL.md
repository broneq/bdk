---
name: commit
description: Generate conventional commit message based on git changes
model: haiku
arguments:
  - name: instruction
    description: "Optional: scope of changes to analyze (e.g. 'from main', 'only src/foo.py'). Default: current changes"
    required: false
---

# Generate Commit Message

1. **No argument:** Propose commit message for current changes (staged, or unstaged if nothing staged).
2. **Argument (`$ARGUMENT`):** Analyze the instruction and figure out how to get the relevant diff.
3. If no changes found, say so and stop.

Last 5 recent commits (to match project style):
!`git log --oneline -5`

Generate message:

```
<type>: <subject, max 72 chars, imperative mood>

<body: proportional to scope of changes, explain WHY not WHAT>
```

Types: feat / fix / refactor / test / docs / chore / perf / style

**Rules:** NEVER execute git commit. Only propose the message.
