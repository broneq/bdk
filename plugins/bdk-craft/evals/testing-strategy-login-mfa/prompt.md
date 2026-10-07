---
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Our login now has a second step: after the password, users enter a six-digit code from an authenticator app; five wrong codes lock the account for 15 minutes. The frontend is React, the backend is a Node service with its own user database. Propose how to test it and show example tests.
