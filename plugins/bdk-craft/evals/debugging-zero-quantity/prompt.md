---
max_turns: 60
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill]
---

A customer complains: they set an item in the cart to quantity 0 to "save it for later", and the checkout still charged them for one unit. Cart code is in `src/`. Track it down and fix it.
