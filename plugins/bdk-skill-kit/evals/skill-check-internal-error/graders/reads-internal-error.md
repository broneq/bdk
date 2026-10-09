---
type: llm
---

PASS if the reply says that skill-check itself did not finish: its rule `acme/no-todo` (in `acme-rules.mjs`) failed or crashed, so this is not a finding in `skills/release-notes/SKILL.md`, and the skill was not actually checked. Naming exit code 3 or "internal error" counts; proposing or making a fix to `acme-rules.mjs`, or rerunning with `SKILL_CHECK_DEBUG=1`, is fine.
FAIL if the reply reports a finding in the skill, says the skill passed or is clean without a completed run, or says it changed the skill to satisfy the check.
