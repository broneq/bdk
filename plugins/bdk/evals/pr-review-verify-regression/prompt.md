---
description: "/bdk:pr-review --verify on the fixture PR 7, which holds the user's earlier review with blocker threads on the parse bug and the cents/dollars seam, and two new commits that fix both but make the report keep only the last entry of each month: the lead seeds the previous findings, reviews the commits since the reviewed head with reviewers, the integration reviewer and the judge; the main thread posts one REQUEST_CHANGES verify review with an inline comment on the new src/report.js blocker and resolves both old threads, as the user asked to post without a question."
tags: [orchestrator]
max_turns: 60
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The author of https://github.com/bdk-eval/repo/pull/7 pushed fixes after my review. Verify my previous review against the current head and post the result to GitHub right away, don't ask me first.
