---
type: regex
target: { source: file, path: .git/logs/refs/heads/add-totals }
pattern: 'bdk/add-totals/part-02[^\n]*\n[\s\S]*\tcommit: [^\n]*[Pp]art 03'
---

On the Change branch add-totals, part 03 was committed after the merge of part 02, as a plain commit.
