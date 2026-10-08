---
description: "/bdk:debug with the default manual design gate: the bug is reproduced and diagnosed, then the run asks before fixing and starts nothing else."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash, AskUserQuestion]
---

Fix this bug: after `tally add 5`, `tally total` crashes with "TypeError: total.toFixed is not a function" instead of printing the sum. Call the fix change fix-total-crash.
