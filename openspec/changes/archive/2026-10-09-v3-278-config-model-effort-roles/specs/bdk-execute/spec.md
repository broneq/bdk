## MODIFIED Requirements

### Requirement: Retries and escalation

A part SHALL get at most `policy.budgets.part-attempts` implementer runs in one execute run; the last run within the budget SHALL use the model `policy.escalation.model` and the effort `policy.escalation.effort`, or `models.implementer.effort` when `policy.escalation.effort` is not set, and no effort when neither is set. A part SHALL be retried when its implementer reports `Status: blocker` with `Kind: other`, or its conformer reports `Verdict: FAIL`, or either agent returns no report; a retry SHALL run the implementer on the same work directory and then the conformer again. A blocker of `Kind: plan-defect` or `Kind: environment` SHALL NOT be retried: the part SHALL be marked `blocked` at once. A part whose budget is spent SHALL be marked `blocked` with the last report's reason. After a wave with a blocked part the lead SHALL merge the parts of that wave that are done and SHALL NOT start a later wave. The second `resolve-conflict` run of a part SHALL use the same escalated model and effort.

#### Scenario: Plan defect stops the part

- **WHEN** the implementer of part `02` reports `Status: blocker` and `Kind: plan-defect`
- **THEN** no second implementer starts for part `02`, `state.json` marks `02` `blocked` with 1 attempt and a reason naming the plan defect, and no later wave starts

#### Scenario: Escalation on the last attempt

- **WHEN** `policy.budgets.part-attempts` is 3, `policy.escalation.effort` is `high`, and the conformer of part `01` reports `Verdict: FAIL` twice
- **THEN** the third implementer of part `01` starts with `model` set to `policy.escalation.model` and `effort` `high`

#### Scenario: Single attempt is the escalated one

- **WHEN** `policy.budgets.part-attempts` is 1, `policy.escalation.model` is `sonnet` and `policy.escalation.effort` is `low`
- **THEN** the first and only implementer of each part starts with `model` `sonnet` and `effort` `low`
