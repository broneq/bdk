## ADDED Requirements

### Requirement: verify-plan checks the acceptance criteria

`verify-plan` SHALL read `.bdk/runs/<change>/source/issue.md` when present, `## Intent` and `## Acceptance` of `proposal.md`, and `scope-log.md`, as the reference. A `Must address` item SHALL be an AC of `## Acceptance` that no `By: user` scope-log entry dropped and that no part carries, through a scenario it lists under `## Acceptance scenarios` that answers the AC or through a task that names the AC's id, and an AC a part narrows or changes with no `By: user` entry naming it. Its evidence SHALL quote the AC and name the parts searched.

#### Scenario: AC without a part

- **WHEN** `## Acceptance` holds `AC-2` "the balance skips void entries", no `By: user` entry drops it, and no part lists a scenario or a task for it
- **THEN** the report starts with `Verdict: FAIL` and its `## Must address` names `AC-2`
