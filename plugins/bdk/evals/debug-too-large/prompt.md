---
description: "/bdk:debug on the tally crash with plan parts limited to one file: diagnose-bug reproduces the bug and writes the fix Change without a plan part (Status: too-large), and the run stops naming /bdk:design without gating, committing or building."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

Fix this bug: after `tally add 5`, `tally total` crashes with "TypeError: total.toFixed is not a function" instead of printing the sum. Call the fix change fix-total-crash.
