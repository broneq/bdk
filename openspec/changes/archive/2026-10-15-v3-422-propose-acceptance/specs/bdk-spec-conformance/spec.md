## ADDED Requirements

### Requirement: Acceptance criteria checked

The block SHALL read `.bdk/runs/<change>/source/issue.md` when present, `## Intent` and `## Acceptance` of `proposal.md`, and `scope-log.md`, in a round check and at close. A `Must address` item SHALL be: an AC that no `By: user` scope-log entry dropped and that the product does not meet, traced from its entry point through the code as a scenario is; an AC the product or the deltas narrow or change with no `By: user` entry naming it; an AC whose only coverage is a deferred finding of a review round with no `By: user` entry for it, because "deferred" without the user is not coverage. In a round check each item SHALL also be a finding in the round's log, as the other items are. Its evidence SHALL quote the AC by its id.

#### Scenario: AC deferred without the user

- **WHEN** at close `## Acceptance` holds `AC-3`, the product does not meet it, the last review round deferred the finding that names it, and `scope-log.md` holds no entry for `AC-3`
- **THEN** `close/spec-conformance.md` starts with `Verdict: FAIL` and its `## Must address` names `AC-3`
