---
description: "/bdk:execute on add-totals: one bdk:lead runs two worktree parts of one wave in parallel, commits them, merges them in part order on the branch add-totals, has the conflict in src/ledger.js resolved by resolve-conflict, and writes state.json and the result."
tags: [orchestrator]
max_turns: 80
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The plan of the change add-totals is verified. Build it.
