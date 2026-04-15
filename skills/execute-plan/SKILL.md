---
name: execute-plan
description: Execute an implementation plan, then run tests and static analysis, fixing issues
model: sonnet
user-invocable: true
argument-hint: "[plan]"
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
hooks:
  Stop:
    - hooks:
        - type: command
          command: "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/skills/execute-plan/scripts/context-usage.py"
  PostToolUse:
    - matcher: "TaskUpdate"
      hooks:
        - type: command
          command: "python3 \"$CLAUDE_PROJECT_DIR\"/.claude/skills/execute-plan/scripts/context-usage.py"
---

# Execute Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

## Step 0: Create Task List

Before executing, create TaskList from plan:

- One `TaskCreate` per implementation task
- Set status `in_progress` on start, `completed` when done

## Step 1: Execute the Plan

$ARGUMENTS

Per task:

1. **Has `**Test cases:**` section?**
   - YES → invoke `/bdk:test-driven-development` before any implementation. Pass test bullets + implementation desc. No implementation until GATE 2 (RED verified).
   - NO → implement directly (e.g. refactor-only)

2. After `completed`, check context:
   - **< 40%** → next task
   - **≥ 40%** → pause, write:
     > ⚠️ Context at XX% — consider running `/bdk:save-progress [slug]` before continuing.
     Ask: "Continue or save progress first?" Wait for response.

3. Blocked or unclear → stop, ask user

## Step 2: Verify and Fix

All tasks done → inject project tools context:

- Test tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py test-tools`
- Lint tools: !`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/get_settings.py lint-tools`

Run verification agents **in parallel**:

### 2a. Run Tests

Delegate to `test-runner` agent using injected test command above. Tests fail → fix, re-run. Repeat until pass.

### 2b. Run Static Analysis

Delegate to `static-analyse` agent using injected lint command above. Issues found → fix, re-run. Repeat until clean.

## Rules

- Main agent fixes issues, subagents only *run*
- Max 3 fix-and-rerun cycles per step before asking user
- NEVER hardcode test or lint commands — use injected values, fall back to detecting from project context