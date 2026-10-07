---
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

We need `addBusinessDays(date, days, holidays = [])` in `src/businessDays.js`: it skips Saturdays, Sundays and the dates in the optional holiday list (ISO `YYYY-MM-DD` strings), accepts a negative number of days, and never mutates the `Date` it receives. Build it TDD, tests next to the file.
