Result: pass
Requirement: Total
Scenario: Total after an add
Spec: openspec/changes/fix-total-crash/specs/tally/spec.md:14
Item: cli (cli)

## Steps
1. `node /abs/project/bin/tally.js add 5` in a fresh directory -> exit 0, `Added 5.00`
2. `node /abs/project/bin/tally.js total` in the same directory -> exit 0, `Total: 5.00`

## Expected
`Total: 5.00`, exit 0

## Observed
exit 0, `Total: 5.00`
