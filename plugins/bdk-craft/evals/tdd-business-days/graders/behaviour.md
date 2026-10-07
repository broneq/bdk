---
type: llm
focus: { source: file, path: src/businessDays.js }
---

Judge the behaviour of this addBusinessDays function, not its style.

PASS if, traced by hand, it never modifies the Date passed in, skips Saturdays and Sundays, skips dates whose YYYY-MM-DD form is in the holiday list, and moves backwards for a negative number of days.
FAIL if any of these results would be wrong, for example a time-zone conversion that makes the holiday comparison miss a date.
