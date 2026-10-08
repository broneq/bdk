---
type: regex
target: trace
pattern: 'plan: \d+ parts, [1-3] waves?, ok'
---

A `bdk plan check` of the parts passed with at most three waves: the parts keep the default part limits and no two parts of a wave share a file.
