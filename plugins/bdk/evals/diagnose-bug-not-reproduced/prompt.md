---
description: "A report of a wrong total for an empty ledger does not reproduce on the CLI; no fix Change is written."
tags: [block]
max_turns: 40
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Bug report from a user: in a fresh directory where nothing was added yet, `tally total` prints an error instead of `Total: 0.00`. Find out why and prepare the fix, but do not change the code yet.
