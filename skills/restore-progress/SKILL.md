---
name: restore-progress
description: Restore saved work progress from docs/progress/ to resume a previous session. Loads referenced plans, creates TaskList items for remaining work.
arguments:
  - name: name
    description: "Name of the progress file to restore (e.g. 'auth-refactor'). Reads from docs/progress/{name}.md"
    required: true
user-invocable: true
---

# Restore Progress

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Resume previous work by loading `docs/progress/$ARGUMENTS.md` and recreating task context.

**Announce:** "Restoring progress from docs/progress/$ARGUMENTS.md"

## Step 1: Validate & Load

- If `$ARGUMENTS` is empty: list available progress files from `docs/progress/` and **stop**
- Read `docs/progress/$ARGUMENTS.md`
- If file doesn't exist: list available files and **stop**

## Step 2: Display Summary

```
[restore-progress] Loaded: {name}
  Branch: {branch}
  Saved: {date}
  Tasks: {N done} / {N in_progress} / {N todo}
```

## Step 3: Verify Branch

- Check current git branch matches the saved branch
- If mismatch: warn user and ask whether to continue or switch branches

## Step 4: Display Used Skills

If there is a "Used Skills" section:
- Parse the list of skills and their `Reuse: Yes/No` judgments
- Display:
```
[restore-progress] SKILLS FROM PREVIOUS SESSION:
  ✅ /bdk:skill-name — description | invoke again for remaining tasks
  ⬜ /bdk:another-skill — description | not needed (reason)
```
- For every skill marked `Reuse: Yes`: invoke it automatically, don't wait for user

## Step 5: Load Reference Files

For each file in "Reference Files":
- Read the file to load context
- If a file doesn't exist: warn but continue

## Step 6: Create TaskList

For each task NOT `done`:
- `TaskCreate` with description and status
- `in_progress` tasks → create as `in_progress`
- `todo` tasks → create as `pending`
- `blocked` tasks → create as `pending` with note
- `skipped` tasks → skip

## Step 7: Display Important Notes

```
[restore-progress] IMPORTANT NOTES:
  - {note 1}
```

## Step 8: Start Implementation

After context is restored, immediately begin working on the first `in_progress` or `pending` task.

```
[restore-progress] Context restored. {N} tasks loaded. Starting: {first task description}
```

## Rules

- NEVER delete the progress file
- Load reference files silently
- Start working immediately after restore — don't wait for user prompt
