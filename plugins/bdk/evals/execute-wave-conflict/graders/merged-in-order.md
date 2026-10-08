---
type: regex
target: { source: file, path: .git/logs/refs/heads/add-totals }
pattern: 'bdk/add-totals/part-01[\s\S]*commit \(merge\): Merge branch .bdk/add-totals/part-02'
---

On the Change branch add-totals, part 01 was merged before part 02, whose merge was committed after its conflict.
