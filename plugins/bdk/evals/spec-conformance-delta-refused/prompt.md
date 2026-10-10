---
description: "spec-conformance --round, on the bdk:verifier agent, fails a delta that OpenSpec refuses, as close did in the #368 run: the requirement Bad amount has no scenario while the product does what it says. It writes Verdict: FAIL in the round's report and logs a spec-conformance finding on the delta, so the round fixes it instead of close stopping on it."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Bash]
---

Review round 1 of add-total is running (.bdk/runs/add-total/review/round-1). As the round's spec check, find where the specs of add-total do not describe what the product does after this branch, and put each problem into the round's findings log so the review can fix it.
