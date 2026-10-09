---
description: "/bdk:execute on add-totals after a break: parts 01 and 02 are merged, part 03 is alone in its wave but its worktree from the broken run holds its test, so the bdk:lead builds it in that worktree and merges it."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The plan of the change add-totals is verified and its build broke off. Build the rest.
