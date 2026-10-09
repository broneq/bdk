---
type: regex
target: { source: file, path: .bdk/runs/add-total/execute/part-02.md }
pattern: '^Status: done\n[\s\S]*Empty ledger[^\n]*; green at first run \(behaviour present\); green seen\n'
---

The acceptance signal of #346: the part is done, and its report says the test passed at its first run because the behaviour is present.
