---
description: "triage under policy.gates.review: auto decides every finding of a judged round by the fixed policy (D3) - blocker and should-fix fix, nice-to-have defer without an issue, not-a-problem accept - records each decision with bdk findings decide and asks nothing."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, AskUserQuestion]
---

Review round 1 of the monthly-report change is judged (.bdk/runs/monthly-report/review/round-1). Triage its findings: decide what happens to each one.
