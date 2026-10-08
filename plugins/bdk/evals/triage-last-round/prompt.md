---
description: "triage --last-round under policy.gates.review: auto defers the should-fix finding with a reason naming policy.budgets.review-rounds (D3: should-fix only within the round budget), and decides the other levels by the fixed policy."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, AskUserQuestion]
---

Review round 1 of the monthly-report change is judged (.bdk/runs/monthly-report/review/round-1), and it is the last round the review budget allows. Triage it with --last-round.
