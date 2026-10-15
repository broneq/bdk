## ADDED Requirements

### Requirement: Integration review checks the acceptance criteria

`review-integration` SHALL read, for a Change, `.bdk/runs/<change>/source/issue.md` when present, `## Intent` and `## Acceptance` of `proposal.md`, and `scope-log.md`, next to the intent it reads today. For each AC that no `By: user` scope-log entry dropped, it SHALL follow the AC as a user checks it, from its entry point through the code, as it follows a scenario. An AC the product does not meet, and an AC the code narrows or changes with no `By: user` entry naming it, SHALL each be a finding whose evidence quotes the AC by its id.

#### Scenario: AC not met

- **WHEN** `## Acceptance` holds `AC-2` "the balance skips void entries" and `balance` in the reviewed range still sums every entry
- **THEN** the round's log holds a `review-integration` finding whose evidence names `AC-2`
