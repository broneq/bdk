---
name: alpha
description: Reviews a design document against its checklist. Use when a design is ready for review.
argument-hint: "[path]"
allowed-tools: Read Grep
effort: medium
---

# Alpha

Read the design at `$ARGUMENTS`, then apply the checklist in [the guide](references/guide.md).

Report each failed item with the section it came from.
