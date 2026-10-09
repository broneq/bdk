---
description: "skill-check exits 3 because a plugin rule of the project throws: the reply calls it a failure of that rule, not a finding in the skill, and leaves the skill alone."
max_turns: 25
allowed_tools: [Read, Glob, Grep, Edit, Skill, Bash]
---

I just wrote the skill `skills/release-notes`. Run skill-check on the project and fix whatever it reports before I commit.
