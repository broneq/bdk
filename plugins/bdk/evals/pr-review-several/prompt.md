---
description: "/bdk:pr-review with two fixture PRs in one call: PR 7 (the monthly-report Change with a parse bug and a cents/dollars seam bug) and PR 8 (a correct one-line README change). One bdk:lead per PR runs in parallel, and the main thread posts REQUEST_CHANGES on 7 and APPROVE on 8 after both returned, as the user asked to post without a question."
tags: [orchestrator]
max_turns: 80
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

Review https://github.com/bdk-eval/repo/pull/7 and https://github.com/bdk-eval/repo/pull/8 and post both reviews to GitHub. Don't ask me first, post them right away.
