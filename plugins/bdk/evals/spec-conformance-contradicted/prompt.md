---
description: "spec-conformance, on the bdk:verifier agent, fails a Change whose code exits 1 on an empty ledger while its spec delta says it prints Total: 0.00."
tags: [block]
max_turns: 40
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Bash]
---

Before I archive the change add-total: check that its spec deltas describe what the product actually does now.
