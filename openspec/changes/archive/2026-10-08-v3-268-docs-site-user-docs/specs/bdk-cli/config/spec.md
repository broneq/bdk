## ADDED Requirements

### Requirement: Every settings key has a description
The settings schema SHALL hold a one-sentence description for every key of the Settings keys table, including each field of an item addressed by `id` (`tools.test.<id>.command`) and the value of a record key (`models.<role>`, `steps.<orchestrator>`). The description SHALL be the text the settings Reference shows for the key; there SHALL be no second place that describes a key for users. Every top-level key SHALL also carry at least one example value, and every example SHALL be valid settings. A workspace test SHALL fail and name the key when a key has no description, when a top-level key has no example, or when an example is not valid.

#### Scenario: New key without a description
- **WHEN** a contributor adds `execution.timeout` to the settings schema without a description
- **THEN** `pnpm check` fails and names `execution.timeout`

#### Scenario: Invalid example
- **WHEN** the example of `policy` sets `questions: ask`
- **THEN** `pnpm check` fails and names `policy` and the example

#### Scenario: Description reaches the Reference
- **WHEN** the description of `policy.budgets.review-rounds` changes in the settings schema and the Reference is regenerated
- **THEN** the settings Reference page shows the new description for `policy.budgets.review-rounds`
