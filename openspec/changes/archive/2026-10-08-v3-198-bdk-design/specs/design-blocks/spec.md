# Spec Delta

## ADDED Requirements

### Requirement: Design draft revises on a request

When the Change already has a `design.md`, the last `.bdk/runs/<change>/design/verify-N.md` does not say `Verdict: FAIL`, and the arguments carry a revision request after the Change name, `design-draft` SHALL change the spec deltas and `design.md` only as far as the request needs, keep every other decision, and reply with what it changed. It SHALL ask the user only when the request leaves a decision open, following `policy.questions`.

#### Scenario: Revision requested at the design gate

- **WHEN** `design-draft` runs with the arguments `add-csv-export quote every label` and the Change holds a passed design that quotes only labels with a comma, a quote or a line break
- **THEN** the spec delta and `design.md` say that every label is quoted, the other decisions of `design.md` are unchanged, and the reply names the change
