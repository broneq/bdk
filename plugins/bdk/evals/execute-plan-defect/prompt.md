---
description: "/bdk:execute on add-totals whose part 02 contradicts its acceptance scenario: part 01 is built and merged, part 02 stops on a plan defect without a retry, and the blocker reaches the user with /bdk:plan."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The plan of the change add-totals is verified. Build it.
