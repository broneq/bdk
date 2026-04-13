---
name: save-progress
description: Save current work progress to .bdk/save-progress/ for resuming in a future session. Use when context is large, work is in progress, and you want to stop and continue later.
model: haiku
argument-hint: "[name]"
user-invocable: true
---

# Save Progress

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Capture work state to `.bdk/save-progress/$ARGUMENTS.md` for future resume.

**Announce:** "Saving progress to .bdk/save-progress/$ARGUMENTS.md"

## Step 1: Validate

- `$ARGUMENTS` empty: say "Usage: /bdk:save-progress <name>" and **stop**
- Set path: `.bdk/save-progress/$ARGUMENTS.md`

## Step 2: Gather Context

Collect in parallel:

1. **Git branch**: `git branch --show-current`
2. **TaskList**: Read current tasks (if any)
3. **Recent files**: `git diff --name-only HEAD~3..HEAD 2>/dev/null`
4. **Used skills**: Recall from conversation history

## Step 3: Build Task Summary

**TaskList has tasks:**
- List each task + status (pending/in_progress/completed)
- `AskUserQuestion`: "Want to add notes or adjust statuses before saving?"
- Options: "Save as-is", "Let me edit"

**No tasks:**
- Ask user: "No tracked tasks found. Describe current tasks and status."

## Step 4: Collect Reference Files

`AskUserQuestion`:
- "Which files needed for context when resuming?"
- Options: auto-suggest from git diff + .bdk/ plan files, plus "Let me specify"

## Step 5: Collect Used Skills

From history, identify every BDK skill invoked. For each:
1. One-line "why" — trigger + outcome
2. Judgment: useful for remaining tasks?

## Step 6: Collect Important Notes

Ask user:
- "Critical notes for next session?"
- Options: "No notes needed", "Let me add notes"

## Step 7: Write Progress File

Write to `.bdk/save-progress/$ARGUMENTS.md`:

```markdown
# Progress: {name}

**Branch:** {current branch}
**Saved:** {YYYY-MM-DD}
**Status:** In Progress

---

## Used Skills

- `/bdk:skill-name` — Brief description | **Reuse: Yes/No** (reason)

## Reference Files

- `{path/to/plan.md}` — Description

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | {task description} | done | |
| 2 | {task description} | in_progress | |
| 3 | {task description} | todo | |

## Important Notes

- {note 1}
```

## Step 8: Confirm

```
[save-progress] Saved to .bdk/save-progress/$ARGUMENTS.md
  Tasks: {N done} / {N in_progress} / {N todo}
  References: {N files}
  Skills: {N skills used}
  Notes: {N notes}

Resume with: /bdk:restore-progress $ARGUMENTS
```

## Rules

- NEVER modify source code
- Keep progress file SHORT
- Status values: `done`, `in_progress`, `todo`, `skipped`, `blocked`