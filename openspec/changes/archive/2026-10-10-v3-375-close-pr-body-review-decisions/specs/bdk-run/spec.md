## MODIFIED Requirements

### Requirement: Final report

When every Change of the queue is `done` or waiting, the skill SHALL reply with one line per Change in queue order: the pull request URL and base from `close/pr.md`, or `waiting` with its blockers; then every decision taken without the user, read from the run files of each Change (the decisions of the pull request body in `close/pr.md`, which `/bdk:close` gathers from `proposal.md`, `design.md` and `review/result.md`, so each decision is listed once); and, when a Change waits, that `/bdk:run` continues after its blockers are merged. It SHALL NOT merge a pull request.

#### Scenario: Two pull requests reported

- **WHEN** both Changes of a queue end `done`
- **THEN** the reply names both pull request URLs, each into the base branch
