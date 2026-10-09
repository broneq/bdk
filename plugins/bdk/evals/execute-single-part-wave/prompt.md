---
description: "/bdk:execute on add-totals with waves 1: 01 02 and 2: 03: one bdk:lead runs parts 01 and 02 in their own worktrees and merges them, then runs part 03, alone in its wave, in the main checkout without a worktree and commits it directly on add-totals with no merge commit."
tags: [orchestrator]
max_turns: 100
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The plan of the change add-totals is verified. Build it.
