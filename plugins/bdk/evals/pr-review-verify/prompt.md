---
description: "/bdk:pr-review --verify on the fixture PR 7, which holds the user's earlier review with blocker threads on the parse bug and the cents/dollars seam, and a new head commit that fixes only the parse bug: one bdk:lead re-checks both findings with the judge, the main thread posts one REQUEST_CHANGES verify review and resolves only the parse thread, as the user asked to post without a question."
tags: [orchestrator]
max_turns: 60
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The author of https://github.com/bdk-eval/repo/pull/7 pushed fixes after my review. Verify my previous review against the current head and post the result to GitHub right away, don't ask me first.
