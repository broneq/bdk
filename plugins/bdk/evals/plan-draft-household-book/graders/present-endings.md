---
type: regex
target: trace
pattern: '^(?=[\s\S]*?Verified by: (?:(?!\\n)(?:[^"\\]|\\.))*?No book yet(?:(?!\\n)(?:[^"\\]|\\.))*?; it passes at its first run, the behaviour is present(?:\\n|"))(?=[\s\S]*?Verified by: (?:(?!\\n)(?:[^"\\]|\\.))*?Broken book(?:(?!\\n)(?:[^"\\]|\\.))*?; it passes at its first run, the behaviour is present(?:\\n|"))(?=[\s\S]*?Verified by: (?:(?!\\n)(?:[^"\\]|\\.))*?Bad amount(?:(?!\\n)(?:[^"\\]|\\.))*?; it passes at its first run, the behaviour is present(?:\\n|"))(?=[\s\S]*?Verified by: (?:(?!\\n)(?:[^"\\]|\\.))*?Unknown command(?:(?!\\n)(?:[^"\\]|\\.))*?; it passes at its first run, the behaviour is present(?:\\n|"))'
---

Each of the four scenarios whose behaviour the fixture's code already gives, and that both plans of the #423 measurement marked (`No book yet`, `Broken book`, `Bad amount`, `Unknown command`), is named on a `Verified by:` line that ends `; it passes at its first run, the behaviour is present`, as the parts are written or edited. The present-scenario check of `bdk plan check` (graded by `plan-check-clean`) holds the same ending for every scenario the plan marks.
