#!/usr/bin/env bash
# monthly-report with round 1 judged and its E2E check passed: one should-fix finding whose fix
# is a test (src/parse.test.js reads "\n", never ""), one nice-to-have on the report, no
# decision. A cli e2e item, so a round 2 that wrongly re-runs the E2E check finds one to start.
# Review gate auto and a budget of two rounds in the ignored local layer, so round 1's head
# stays HEAD; a local git identity for the commit of the fix pass.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report.sh"
git config user.name "BDK eval"
git config user.email "eval@example.invalid"
cat > .bdk/settings.local.yaml <<'YAML'
tools:
  e2e:
    - id: cli
      start: node bin/ledger.js --help
      ready: node bin/ledger.js --help
      driver: cli
policy:
  gates:
    review: auto
  budgets:
    review-rounds: 2
# claude -p stops background tasks 10 minutes after its last turn; a round takes longer.
execution:
  lead: foreground
YAML
ROUND=.bdk/runs/monthly-report/review/round-1
cat > "$ROUND/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-5e1b2c7d9a01","source":"review-group","summary":"No test reads an empty ledger file","file":"src/parse.test.js","line":12,"evidence":"The test 'an empty file has no entries' passes \"\\n\", never the empty string \"\" that an empty file gives; parseEntries('') returns [] at src/parse.js:7, so the product is right and only the test misses the case."}
{"type":"finding","id":"f-8c0aba573c66","source":"review-integration","summary":"Report could offer a newest-first month order","file":"src/report.js","line":13,"evidence":"Users with long ledgers may want the latest month first; no scenario asks for it, ascending order matches the spec."}
{"type":"level","id":"f-5e1b2c7d9a01","level":"should-fix","reason":"A test gap on the empty-file case the spec names; the product already handles it."}
{"type":"level","id":"f-8c0aba573c66","level":"nice-to-have","reason":"No scenario asks for a newest-first order; ascending matches the spec."}
JSONL
cat > "$ROUND/review.md" <<'MD'
# Review round report

2 findings. Level: 0 blocker, 1 should-fix, 1 nice-to-have, 0 not-a-problem, 0 unleveled. Decision: 0 fix, 0 accept, 0 defer, 2 undecided.

## should-fix

- f-5e1b2c7d9a01 `src/parse.test.js:12` No test reads an empty ledger file (review-group)
  - Evidence: The test 'an empty file has no entries' passes "\n", never the empty string "" that an empty file gives; parseEntries('') returns [] at src/parse.js:7, so the product is right and only the test misses the case.
  - Level reason: A test gap on the empty-file case the spec names; the product already handles it.

## nice-to-have

- f-8c0aba573c66 `src/report.js:13` Report could offer a newest-first month order (review-integration)
  - Evidence: Users with long ledgers may want the latest month first; no scenario asks for it, ascending order matches the spec.
  - Level reason: No scenario asks for a newest-first order; ascending matches the spec.
MD
mkdir -p "$ROUND/e2e"
cat > "$ROUND/e2e/report-totals--main.md" <<'MD'
Result: pass
Process: report-totals
Path: main (main)
Proposal: openspec/changes/monthly-report/proposal.md:7 - New command `ledger report <file>` prints the total of each month.
Item: cli (cli)

## Steps
1. `node /abs/bin/ledger.js report ledger.csv` -> exit 0

## Expected
One line per month, ascending, with its total.

## Observed
As expected.
MD
cat > "$ROUND/e2e/verdict.md" <<'MD'
Verdict: PASS

## report-totals
- pass: main (main, proposal.md:7) - report-totals--main.md

## Not a user process
- None.
MD
cat > "$ROUND/round.md" <<'MD'
Round: 1
Report: review.md

## E2E
- round-1/e2e/verdict.md: Verdict: PASS
MD
