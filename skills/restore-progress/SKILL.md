---
name: restore-progress
description: Restore saved work progress from .bdk/progress/ to resume a previous session. Loads referenced plans, creates TaskList items for remaining work.
argument-hint: "[name]"
user-invocable: true
model: sonnet
---

# Restore Progress

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Resume previous work by loading `.bdk/progress/$ARGUMENTS.md` and recreating task context.

**Announce:** "Restoring progress from .bdk/progress/$ARGUMENTS.md"

## Step 1: Validate & Load

- If `$ARGUMENTS` empty: list available progress files from `.bdk/progress/` and **stop**
- Read `.bdk/progress/$ARGUMENTS.md`
- If file missing: list available files and **stop**

## Step 2: Display Summary

```
[restore-progress] Loaded: {name}
  Branch: {branch}
  Saved: {date}
  Tasks: {N done} / {N in_progress} / {N todo}
```

## Step 3: Verify Branch

- Check current git branch matches saved branch
- If mismatch: warn user, ask continue or switch

## Step 4: Display Used Skills

If "Used Skills" section exists:
- Parse skill list and `Reuse: Yes/No` judgments
- Display:
```
[restore-progress] SKILLS FROM PREVIOUS SESSION:
  ✅ /bdk:skill-name — description | invoke again for remaining tasks
  ⬜ /bdk:another-skill — description | not needed (reason)
```
- For every skill marked `Reuse: Yes`: invoke automatically, don't wait for user

## Step 5: Load Reference Files

For each file in "Reference Files":
- Read file to load context
- If missing: warn but continue

## Step 6: Create TaskList

For each task NOT `done`:
- `TaskCreate` with description and status
- `in_progress` → create as `in_progress`
- `todo` → create as `pending`
- `blocked` → create as `pending` with note
- `skipped` → skip

## Step 7: Display Important Notes

```
[restore-progress] IMPORTANT NOTES:
  - {note 1}
```

## Step 8: Start Implementation

After context restored, immediately begin first `in_progress` or `pending` task.

```
[restore-progress] Context restored. {N} tasks loaded. Starting: {first task description}
```

## Rules

- NEVER delete progress file
- Load reference files silently
- Start working immediately after restore — don't wait for user