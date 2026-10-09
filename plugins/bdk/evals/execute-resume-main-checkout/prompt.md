---
description: "/bdk:execute on add-totals after part 03, alone in its wave, ended blocked in the main checkout: its test is still uncommitted there, so the bdk:lead does not stop on uncommitted changes, builds part 03 in the main checkout from those files and commits it on add-totals."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The plan of the change add-totals is verified; part 03 was blocked last time and nothing has changed since. Build the rest.
