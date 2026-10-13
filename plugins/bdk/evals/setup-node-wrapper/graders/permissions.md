---
type: llm
---

PASS if the final reply either says the permission allow rules were added to `.claude/settings.json`, or lists the rules for the user to add, including `Bash(bdk *)`, `Bash(git *)` and the project's test command.
FAIL if the reply does not mention permission rules at all.
