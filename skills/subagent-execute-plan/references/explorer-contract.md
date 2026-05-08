# Explorer Contract

Source of truth for the JSON `bdk:explorer` returns when the coordinator (`/bdk:subagent-execute-plan` Step 1) asks it to compute parallel groups. Dispatch templates cite this file — do not restate the schema elsewhere.

## Schema

```json
{
  "confidence": 0.0,
  "groups": [
    { "tasks": ["1.1", "1.2"], "rationale": "disjoint files: schema.ts vs test-helpers.ts" },
    { "tasks": ["1.3"], "rationale": "verification step depends on 1.1+1.2" },
    { "tasks": ["2.1"], "rationale": "touches files modified by 1.1, must serialize after group 1" }
  ],
  "warnings": ["..."]
}
```

## Field semantics

| Field | Type | Meaning |
|---|---|---|
| `confidence` | float `[0.0, 1.0]` | How certain the explorer is that the file-disjointness signal is reliable. Lower when plan-declared paths are sparse, ambiguous, or absent. |
| `groups` | ordered array | Groups execute in array order. Within a group, tasks may run in parallel. |
| `groups[].tasks` | array of task ids | Task ids must reference real entries in the plan. |
| `groups[].rationale` | short string | Why these tasks are grouped (or why this task is alone). |
| `warnings` | array of strings | Anything the coordinator should know but is not a hard error (e.g., "task 2.1 declares no files; assumed serial"). |

## Grouping rules the explorer must follow

- Group only tasks that touch **fully disjoint** file sets AND have no declared ordering dependency in the plan text.
- "Verify" / "run tests" / "fix any failures" tasks → their own group, after the tasks they verify.
- Two tasks touching the same file with no declared dependency → serialize (own group each), do not parallelize.
- Prefer fewer, larger groups over many tiny groups.

## Coordinator-side fallback

The coordinator switches to **full serial mode** (every task its own group, in plan order) if any of the following hold:

- JSON is malformed or missing required fields.
- `confidence < 0.6`.
- Any `groups[].tasks` entry references an undefined task id.

Fallback is silent (logged but does not halt the run) — serial mode is always safe.

## Confidence calibration hints (for the explorer prompt)

- Plan declares explicit file paths for every task, all clearly disjoint → `0.9–1.0`.
- File paths declared for most tasks but a few inferred from titles → `0.7–0.85`.
- Mostly inference from task titles, plan light on path declarations → `0.5–0.7`.
- No path declarations, structural guesses only → `< 0.5` (forces serial fallback).
