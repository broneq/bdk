---
description: "The tally crash is reported by a user whose ledgers already hold amounts written as text: the fix Change keeps the reproduction as its only acceptance scenario and names those ledgers as a related defect, not fixed (#359)."
tags: [block]
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Bug report from a user: after `tally add 5`, running `tally total` crashes with "TypeError: total.toFixed is not a function" instead of printing the sum. I have been using tally for weeks, and the ledger.json files in my project folders hold entries like "5" and "2.5". Find out why and prepare the fix, but do not change the code yet. Call the fix change fix-total-crash.
