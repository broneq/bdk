---
type: regex
target: { source: file, path: .bdk/runs/add-total/execute/conform-01.md }
pattern: '## Left\n(?:(?!\n## )[\s\S])*task 1'
---

The missing scenario is left under `## Left` naming task 1, so the implementer's retry adds it.
