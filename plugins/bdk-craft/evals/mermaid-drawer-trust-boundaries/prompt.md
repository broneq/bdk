---
max_turns: 20
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill]
---

Draw the trust boundaries of our login flow: the browser on the public internet, our edge (CDN and WAF), our private network (API gateway, auth service, session store in Redis, users database), and the external identity provider for Google sign-in. Group each zone visibly.
