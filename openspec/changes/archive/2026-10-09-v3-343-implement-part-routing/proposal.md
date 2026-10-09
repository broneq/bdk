## Why

Tracks #343.

In 1 of 3 runs of the eval `implement-part-csv` ("Implement part 01 of the plan of the change add-csv-export.") the main session invoked `/bdk:execute add-csv-export 01` instead of `implement-part`. `/bdk:execute` took the part id as noise, its lead found no way to build one part and wrote `Status: blocked`, and the run scored 0.00. The description of `/bdk:execute` invites the call ("when asked to ... 'implement' a Change or its plan"), and nothing in the skill says what to do with a part id.

## What Changes

- The description of `/bdk:execute` says it builds every part of the plan and names `implement-part` for one part; the description of `implement-part` says it builds one part, not the whole plan.
- `/bdk:execute` takes no part id. Called with a part id (`/bdk:execute add-csv-export 01`) or asked for one part, it starts no lead and replies with `/bdk:implement-part <change> <part-id>` as the command that builds one part.
- A new orchestrator eval case `execute-one-part` grades that reply; `implement-part-csv` is the routing case for the block (acceptance: 6 of 6 runs invoke `implement-part`).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bdk-execute`: a new requirement for the routing between the whole plan (`/bdk:execute`) and one part (`implement-part`).

## Impact

- `plugins/bdk/skills/execute/SKILL.md`, `plugins/bdk/skills/implement-part/SKILL.md` (descriptions; one rule in step 1 of `execute`).
- `plugins/bdk/evals/execute-one-part/` (new case), `plugins/bdk/evals/README.md`.
- User docs: `docs/guide/workflow.md` (Execute section) and `docs/concepts/orchestrators.md` (`/bdk:execute` section) say how one part is built; `docs/reference/` regenerated with `pnpm docs:reference`.
