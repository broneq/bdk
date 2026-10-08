#!/usr/bin/env bash
# The monthly-report project with review round 1 judged: one finding of each level, no decision
# yet, and review.md as `bdk findings report` writes it. The start of every triage case.
set -euo pipefail
bash "$(dirname "$0")/monthly-report.sh"
ROUND=.bdk/runs/monthly-report/review/round-1
cat > "$ROUND/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-9ffca2edd413","source":"review-group","summary":"Amounts with fewer than two decimals parse to the wrong number of cents","file":"src/parse.js","line":13,"evidence":"parseEntries('2026-01-01,x,7') gives amount 7, not 700, and '12.5' gives 125, not 1250: the decimal point is dropped instead of scaling by 100. Spec scenario 'Amounts with fewer decimals' fails; the part's tests use only two-decimal amounts."}
{"type":"finding","id":"f-093cc3ee1fa8","source":"review-group","summary":"Abbreviated identifier amt","file":"src/parse.js","line":12,"rule":"BDK-CQ-1","evidence":"amt abbreviates amount; BDK-CQ-1 asks for descriptive identifiers without abbreviations."}
{"type":"finding","id":"f-7f8d50faa9d4","source":"review-group","summary":"parseEntries crashes on an empty file","file":"src/parse.js","line":6,"evidence":"parseEntries('') splits the empty string into one line and reads amt of undefined, so .replace throws a TypeError."}
{"type":"finding","id":"f-8c0aba573c66","source":"review-integration","summary":"Report could offer a newest-first month order","file":"src/report.js","line":13,"evidence":"Users with long ledgers may want the latest month first; no scenario asks for it, ascending order matches the spec."}
{"type":"level","id":"f-9ffca2edd413","level":"blocker","reason":"Breaks the spec scenario 'Amounts with fewer decimals': '7' parses to 7 cents, not 700."}
{"type":"level","id":"f-093cc3ee1fa8","level":"should-fix","reason":"Breaks rule BDK-CQ-1 (descriptive identifiers); the product works."}
{"type":"level","id":"f-7f8d50faa9d4","level":"not-a-problem","reason":"parseEntries returns [] for blank input at src/parse.js:7 before splitting, so the crash does not happen."}
{"type":"level","id":"f-8c0aba573c66","level":"nice-to-have","reason":"No scenario asks for a newest-first order; ascending matches the spec."}
JSONL
cat > "$ROUND/review.md" <<'MD'
# Review round report

4 findings. Level: 1 blocker, 1 should-fix, 1 nice-to-have, 1 not-a-problem, 0 unleveled. Decision: 0 fix, 0 accept, 0 defer, 4 undecided.

## blocker

- f-9ffca2edd413 `src/parse.js:13` Amounts with fewer than two decimals parse to the wrong number of cents (review-group)
  - Evidence: parseEntries('2026-01-01,x,7') gives amount 7, not 700, and '12.5' gives 125, not 1250: the decimal point is dropped instead of scaling by 100. Spec scenario 'Amounts with fewer decimals' fails; the part's tests use only two-decimal amounts.
  - Level reason: Breaks the spec scenario 'Amounts with fewer decimals': '7' parses to 7 cents, not 700.

## should-fix

- f-093cc3ee1fa8 `src/parse.js:12` [BDK-CQ-1] Abbreviated identifier amt (review-group)
  - Evidence: amt abbreviates amount; BDK-CQ-1 asks for descriptive identifiers without abbreviations.
  - Level reason: Breaks rule BDK-CQ-1 (descriptive identifiers); the product works.

## nice-to-have

- f-8c0aba573c66 `src/report.js:13` Report could offer a newest-first month order (review-integration)
  - Evidence: Users with long ledgers may want the latest month first; no scenario asks for it, ascending order matches the spec.
  - Level reason: No scenario asks for a newest-first order; ascending matches the spec.

## not-a-problem

- f-7f8d50faa9d4 `src/parse.js:6` parseEntries crashes on an empty file (review-group)
  - Evidence: parseEntries('') splits the empty string into one line and reads amt of undefined, so .replace throws a TypeError.
  - Level reason: parseEntries returns [] for blank input at src/parse.js:7 before splitting, so the crash does not happen.

## unleveled

None.
MD
