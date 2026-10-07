---
type: llm
focus: { source: file, path: src/passwordRules.js }
---

Judge the behaviour of this checkPassword function, not its style.

PASS if, traced by hand, it returns an array of the rule ids that a password breaks, with all five rules: `min-length` below 12 characters, `digit`, `letter`, `repeats` when one character appears three or more times in a row (twice is fine), and `email` when the password equals the part of the e-mail before the @ ignoring case.
FAIL if any rule is missing or uses a different threshold.
