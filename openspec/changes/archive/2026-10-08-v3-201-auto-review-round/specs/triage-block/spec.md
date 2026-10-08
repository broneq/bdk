## ADDED Requirements

### Requirement: Last round of the budget

The block SHALL take `--last-round`, given by `/bdk:auto-review` when the round is the last that `policy.budgets.review-rounds` allows. With it, in auto mode a `should-fix` finding SHALL be decided `defer` without an issue, with a reason naming `policy.budgets.review-rounds`, and in manual mode `defer` SHALL be the recommendation for a `should-fix` finding. Every other level SHALL be decided as without it.

#### Scenario: Should-fix in the last round, auto mode

- **WHEN** `policy.gates.review` is `auto` and triage runs with `--last-round` on a judged round holding one finding of each level
- **THEN** the `blocker` is decided `fix`, the `should-fix` `defer` with a reason naming `policy.budgets.review-rounds`, the `nice-to-have` `defer` and the `not-a-problem` `accept`
