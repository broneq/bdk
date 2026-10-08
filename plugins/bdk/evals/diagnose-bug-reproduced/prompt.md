---
description: "A crash of `tally total` after `tally add 5` is reproduced on the CLI first, traced to `add` storing text, and written up as a one-part fix Change; no code is changed."
tags: [block]
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit, Bash]
---

Bug report from a user: after `tally add 5`, running `tally total` crashes with "TypeError: total.toFixed is not a function" instead of printing the sum. Find out why and prepare the fix, but do not change the code yet. Call the fix change fix-total-crash.
