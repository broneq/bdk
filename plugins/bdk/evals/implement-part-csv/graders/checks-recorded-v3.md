---
type: regex
target: { source: file, path: .bdk/runs/add-csv-export/checks/01.json }
pattern: '"version"\s*:\s*3[\s\S]*"cwd"\s*:'
---

The part check was recorded by `bdk check record`: a version 3 result whose checks name their working directory.
