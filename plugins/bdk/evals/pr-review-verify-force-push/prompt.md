---
description: "/bdk:pr-review --verify on the fixture PR 7 after the author squashed and force-pushed it: the head of the user's earlier review is no longer in the pull request's history, so the bdk:lead reviews the whole pull request (round-1/groups.json from the merge base, holding the Change's proposal), the judge levels the previous findings with the new ones, and the main thread posts one REQUEST_CHANGES verify review that says the whole pull request was reviewed and resolves only the parse thread, as the user asked to post without a question."
tags: [orchestrator]
max_turns: 60
allowed_tools: [Read, Glob, Grep, Skill, Agent, SendMessage, Write, Edit, Bash]
---

The author of https://github.com/bdk-eval/repo/pull/7 force-pushed fixes after my review. Verify my previous review against the current head and post the result to GitHub right away, don't ask me first.
