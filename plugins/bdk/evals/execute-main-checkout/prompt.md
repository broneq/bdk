---
description: "/bdk:execute on add-totals with waves 1: 01 02 and 2: 03: one bdk:lead builds every part in the main checkout, one at a time in plan order, commits each part on add-totals, runs no git worktree or merge, and ends done."
tags: [orchestrator]
max_turns: 100
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The plan of the change add-totals is verified. Build it.
