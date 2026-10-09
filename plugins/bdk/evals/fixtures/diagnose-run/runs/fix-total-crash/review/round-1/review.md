# Review round report

2 findings. Level: 0 blocker, 0 should-fix, 1 nice-to-have, 1 not-a-problem, 0 unleveled. Decision: 0 fix, 1 accept, 1 defer, 0 undecided.

## blocker

None.

## should-fix

None.

## nice-to-have

- f-f167055ae8bb `test/tally.test.js:21` Scenario Empty ledger (in the Change's spec delta) has no test (review-integration)
  - Evidence: specs/tally/spec.md restates Requirement: Total with Scenario Empty ledger (tally total in a fresh directory prints 'Total: 0.00', exit 0). The code gives that (load() returns [], reduce gives 0), but no test runs tally total in an empty directory: test/tally.test.js covers only Total after an add, test/parse.test.js only parseAmount. A regression in total's reduce initial value or in load() for a missing file would pass the suite.
  - Level reason: Product satisfies Empty ledger scenario; missing test is an improvement with no concrete cost, and the Change only asked for the add-then-total test.
  - Decision: defer
  - Decision reason: policy.gates.review auto: nice-to-have

## not-a-problem

- f-8cf77c25ec0b `bin/tally.js:16` total still crashes on ledgers written before the fix (string entries) (review-group)
  - Evidence: ledger.json holding ["5"] from the old add: reduce gives "05" (string), total.toFixed throws TypeError, so tally total still crashes in that directory. load() does not coerce with Number/parseAmount; no test covers a legacy ledger.
  - Level reason: Proposal Out of scope explicitly excludes migrating legacy text ledgers.
  - Decision: accept
  - Decision reason: policy.gates.review auto: not-a-problem

## unleveled

None.
