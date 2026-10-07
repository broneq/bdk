---
description: "ADR: a project without records gets docs/adr/0001 in MADR, with pros and cons for every option and placeholders for people."
tags: [block]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

We decided to keep server data in our own fetch layer under src/api, with loading state per page, instead of adding Redux. The app has no shared client state and Redux would add boilerplate to every admin page. We also looked at TanStack Query, but it is one more dependency for caching we do not need yet. The decision is accepted. Please record it as an architecture decision in the repo.
