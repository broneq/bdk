---
description: "/bdk:debug on the tally crash with auto gates: diagnose-bug reproduces it and writes the fix Change, commit, execute builds the part test-first (red, then green), auto-review reviews the fix Change, and debug/result.md names /bdk:close."
tags: [orchestrator]
max_turns: 150
timeout_seconds: 2700
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

Fix this bug: after `tally add 5`, `tally total` crashes with "TypeError: total.toFixed is not a function" instead of printing the sum. Call the fix change fix-total-crash.
