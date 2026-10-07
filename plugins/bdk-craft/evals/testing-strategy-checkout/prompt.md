---
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

We are adding checkout to our React shop: the SPA calls our orders service over REST, the orders service stores orders in Postgres and charges cards through Stripe. How should we test this? Show a few example tests in TypeScript.
