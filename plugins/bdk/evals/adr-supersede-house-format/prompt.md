---
description: "ADR: the record follows the project's own directory, numbering and sections, and marks the record it replaces as superseded."
tags: [block]
max_turns: 20
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

We're moving in-app notifications from polling to server-sent events. Polling every 15 seconds is now about 40% of our API traffic and messages show up late. We considered WebSockets, but our reverse proxy does not pass connection upgrades and we only need server-to-client messages. This is accepted. Write it up as a decision record.
