Result: reproduced
Way in: tools.e2e cli (node bin/tally.js)

## Steps
1. `node <project>/bin/tally.js add 5` in .bdk/runs/fix-total-crash/debug/scratch -> `Added 5.00`, exit 0 (ledger.json holds `["5"]`)
2. `node <project>/bin/tally.js total` -> exit 1

## Expected
`Total: 5.00`, exit 0 (spec tally, Requirement: Total)

## Observed
exit 1, stderr `TypeError: total.toFixed is not a function` at bin/tally.js:20
