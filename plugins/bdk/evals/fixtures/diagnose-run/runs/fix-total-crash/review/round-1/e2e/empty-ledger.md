Result: pass
Requirement: Total
Scenario: Empty ledger
Spec: openspec/changes/fix-total-crash/specs/tally/spec.md:9
Item: cli (cli)

## Steps
1. `node /abs/project/bin/tally.js total` in a fresh directory -> exit 0, stdout `Total: 0.00`

## Expected
`Total: 0.00`, exit 0

## Observed
exit 0, `Total: 0.00`
