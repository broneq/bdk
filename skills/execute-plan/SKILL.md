---
name: execute-plan
description: Execute an implementation plan, then run tests and static analysis, fixing issues
model: sonnet
user-invocable: true
arguments:
  - name: plan
    description: "The full implementation plan to execute"
    required: true
---

# Execute Plan

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

## Step 0: Create Task List

Before executing anything, create a TaskList from the plan tasks:

- One `TaskCreate` per implementation task
- Set status `in_progress` when starting a task, `completed` when done

## Step 1: Execute the Plan

$ARGUMENTS

For each task in the plan:

1. **Does the task have a `**Test cases:**` section?**
   - YES → invoke `/bdk:test-driven-development` skill before writing any implementation code.
     Pass the test case bullet points and the implementation description as context.
     Do not write implementation until the skill reaches GATE 2 (RED verified).
   - NO → implement the task directly (e.g. refactor-only tasks)

2. After marking a task `completed`, check context usage:
   - **< 40%** → continue to the next task
   - **≥ 40%** → pause and write to the user:
     > ⚠️ Context at XX% — consider running `/bdk:save-progress [slug]` before continuing.
     Then ask: "Continue with the next task, or save progress first?" Wait for the response.

3. If blocked or unclear, stop and ask the user

## Step 2: Verify and Fix

After all steps are done, run verification agents **in parallel** and fix any issues they find:

### 2a. Run Tests

Read project context to determine the test command. Delegate to `test-runner` agent to run the test suite. If tests fail: fix the failures, then re-run. Repeat until all tests pass.

### 2b. Run Static Analysis

Read project context to determine the lint/type-check command. Delegate to `static-analyse` agent. If issues found: fix them, then re-run. Repeat until clean.

## Rules

- Fix issues yourself (main agent), only delegate the *running* to subagents
- Max 3 fix-and-rerun cycles per verification step before asking user for help
- NEVER hardcode test or lint commands — always detect from project context
