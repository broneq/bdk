# Subagent Return Contract

Source of truth for the YAML envelope every implementer / fixer subagent must emit as its **final** message. The coordinator (`/bdk:subagent-execute-plan`) and the dispatch templates in `dispatch-templates.md` reference this file — do not restate the schema elsewhere; cite this one.

## Schema

```yaml
status: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
task_id: "1.2"
agent_id: "<id from spawn envelope, for SendMessage continuation>"
files_changed: ["src/a.ts", "src/a.test.ts"]
concerns: []                  # required for DONE_WITH_CONCERNS, else []
needs: ""                     # required for NEEDS_CONTEXT
blocker: ""                   # required for BLOCKED
```

## Rules

- The YAML block MUST be the last thing the subagent emits — no prose before, no prose after.
- Anything else (free-form summary, partial fields, malformed YAML) is treated by the coordinator as `BLOCKED` with reason "malformed return" and triggers a fresh re-dispatch at the same model tier.
- `agent_id` MUST be the value the harness assigned at spawn time, taken verbatim from the spawn envelope. The coordinator uses it for `SendMessage` continuation.
- `files_changed` MUST list every file the subagent edited, including test files. Used for Step 3g declared-vs-actual reconciliation.
- Empty arrays/strings are required for fields that don't apply to the chosen status — do not omit keys.

## Status semantics

| Status | When the subagent emits it |
|---|---|
| `DONE` | Task complete, TDD red-green passed for its own scope. No remaining concerns. |
| `DONE_WITH_CONCERNS` | Task implementation complete, but flagging a correctness/scope/architecture observation the coordinator should triage. Populate `concerns`. |
| `NEEDS_CONTEXT` | Stuck on a missing piece of context (file, decision, clarification). Populate `needs`. Coordinator will `SendMessage` with the answer; subagent resumes. |
| `BLOCKED` | Cannot proceed. Plan ambiguity, environment failure, contradictory spec. Populate `blocker`. Coordinator decides re-dispatch / split / abort. |

## Coordinator action map

See SKILL.md Step 3c for the full action table. Quick reference:

- `DONE` → record `files_changed`, advance.
- `DONE_WITH_CONCERNS` → triage `concerns`; correctness/scope → fixer; observation only → log.
- `NEEDS_CONTEXT` → `SendMessage(to: agent_id, …)`.
- `BLOCKED` → diagnose, then re-dispatch / split / abort.

## What this contract is NOT for

- **Reviewer subagents** (`bdk:code-reviewer`, `bdk:architecture-reviewer`) — different shape (severity-graded findings list). See `dispatch-templates.md`.
- **Verification subagents** (`bdk:test-runner`, `bdk:static-analyse`) — return raw pass/fail + findings, not this envelope. See `dispatch-templates.md`.
- **Explorer** (`bdk:explorer`) — returns the explorer-contract JSON. See `explorer-contract.md`.
