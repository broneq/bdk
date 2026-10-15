## ADDED Requirements

### Requirement: Proposal carries the intent and the acceptance criteria

The `proposal` artifact's instruction and template SHALL hold, after Why and before What Changes, a section `## Intent` (the goal of the issue, or the intent, quoted word for word) and a section `## Acceptance` (the acceptance criteria `AC-1` to `AC-n`, each with a stable id, a conditional one keeping its condition), and the instruction SHALL say that both are written also when the Change sets `skip_specs: true`.

#### Scenario: Template sections

- **WHEN** `openspec instructions proposal --change <name>` runs for a Change opened with the BDK schema
- **THEN** the printed template holds `## Why`, `## Intent`, `## Acceptance` and `## What Changes` in that order, and the instruction names `skip_specs: true` for Intent and Acceptance
