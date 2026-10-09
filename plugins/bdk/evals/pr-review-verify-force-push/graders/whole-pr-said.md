---
type: regex
target: { source: file, path: .git/bdk-eval/reviews/7-2.json }
pattern: 'Reviewed the whole pull request'
---

The verify summary says the whole pull request was reviewed, not the commits since the previous head.
