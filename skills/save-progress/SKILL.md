---
name: save-progress
description: Save current work progress to docs/progress/ for resuming in a future session. Use when context is large, work is in progress, and you want to stop and continue later.
model: haiku
arguments:
  - name: name
    description: "Name for the progress file (e.g. 'auth-refactor', 'api-feature'). Will be saved as docs/progress/{name}.md"
    required: true
user-invocable: true
---

# Save Progress

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Capture current work state to `docs/progress/$ARGUMENTS.md` for resuming in a future session.

**Announce:** "Saving progress to docs/progress/$ARGUMENTS.md"

## Step 1: Validate

- If `$ARGUMENTS` is empty: say "Usage: /bdk:save-progress <name>" and **stop**
- Set path: `docs/progress/$ARGUMENTS.md`

## Step 2: Gather Context

Collect these in parallel:

1. **Git branch**: `git branch --show-current`
2. **TaskList**: Read current TaskList tasks (if any exist)
3. **Recent files**: `git diff --name-only HEAD~3..HEAD 2>/dev/null`
4. **Used skills**: Recall from conversation history which skills were invoked

## Step 3: Build Task Summary

**If TaskList has tasks:**
- List each task with its status (pending/in_progress/completed)
- Present with `AskUserQuestion`: "Want to add notes or adjust statuses before saving?"
- Options: "Save as-is", "Let me edit"

**If no TaskList tasks:**
- Ask user: "No tracked tasks found. Please describe the current tasks and their status."

## Step 4: Collect Reference Files

Ask user with `AskUserQuestion`:
- "Which files should be referenced for context when resuming?"
- Options: auto-suggest from git diff + docs/plans/, plus "Let me specify"

## Step 5: Collect Used Skills

From conversation history, identify every BDK skill invoked. For each:
1. A one-line "why" — what triggered it and what outcome it produced
2. A judgment: will this skill likely be useful for the remaining tasks?

## Step 6: Collect Important Notes

Ask user:
- "Any critical notes for the next session?"
- Options: "No notes needed", "Let me add notes"

## Step 7: Write Progress File

Write to `docs/progress/$ARGUMENTS.md`:

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
[save-progress] Saved to docs/progress/$ARGUMENTS.md
  Tasks: {N done} / {N in_progress} / {N todo}
  References: {N files}
  Skills: {N skills used}
  Notes: {N notes}

Resume with: /bdk:restore-progress $ARGUMENTS
```

## Rules

- NEVER modify source code
- Keep the progress file SHORT
- Status values: `done`, `in_progress`, `todo`, `skipped`, `blocked`
