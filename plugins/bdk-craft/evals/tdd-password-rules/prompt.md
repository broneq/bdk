---
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

Write `checkPassword(password, email)` in `src/passwordRules.js`. It returns the list of rules the password breaks, as an array of rule ids: `min-length` (at least 12 characters), `digit` (at least one digit), `letter` (at least one letter), `repeats` (no character more than twice in a row) and `email` (not equal to the local part of the e-mail, ignoring case). An empty array means the password is fine. Test-first please, tests next to the file.
