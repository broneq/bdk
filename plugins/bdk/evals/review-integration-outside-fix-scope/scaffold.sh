#!/usr/bin/env bash
# monthly-report after review round 1 and its fix pass: round 1 logged the parse bug of amounts
# with fewer than two decimals (decided accept) and a test gap (decided fix), but not the cents
# and dollars seam between src/parse.js and src/report.js. Fix part 03 added one test to
# src/parse.test.js and was committed; round 2 is recorded on that commit with an empty log, as
# `bdk git groups main --rounds .bdk/runs/monthly-report/review --plan <round 1 fix parts>
# --record` records it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/monthly-report.sh"
export GIT_AUTHOR_DATE="2026-10-02T10:00:00Z" GIT_COMMITTER_DATE="2026-10-02T10:00:00Z"
R1=.bdk/runs/monthly-report/review/round-1
R2=.bdk/runs/monthly-report/review/round-2
ROUND1_HEAD=$(git rev-parse HEAD)
cat > "$R1/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-9ffca2edd413","source":"review-group","summary":"Amounts with fewer than two decimals parse to the wrong number of cents","file":"src/parse.js","line":13,"evidence":"parseEntries('2026-01-01,x,7') gives amount 7, not 700, and '12.5' gives 125, not 1250: the decimal point is dropped instead of scaling by 100. Spec scenario 'Amounts with fewer decimals' fails; the part's tests use only two-decimal amounts."}
{"type":"finding","id":"f-5e1b2c7d9a01","source":"review-group","summary":"No test reads an empty ledger file","file":"src/parse.test.js","line":12,"evidence":"The test 'an empty file has no entries' passes \"\\n\", never the empty string \"\" that an empty file gives; parseEntries('') returns [] at src/parse.js:7, so the product is right and only the test misses the case."}
{"type":"level","id":"f-9ffca2edd413","level":"blocker","reason":"Breaks the spec scenario 'Amounts with fewer decimals': '7' parses to 7 cents, not 700."}
{"type":"level","id":"f-5e1b2c7d9a01","level":"should-fix","reason":"A test gap on the empty-file case; the product already handles it."}
{"type":"decision","id":"f-9ffca2edd413","decision":"accept","reason":"User: every ledger we import is exported with two decimals; a follow-up Change handles other files."}
{"type":"decision","id":"f-5e1b2c7d9a01","decision":"fix","reason":"User: add the test."}
JSONL
cat > "$R1/review.md" <<'MD'
# Review round report

2 findings. Level: 1 blocker, 1 should-fix, 0 nice-to-have, 0 not-a-problem, 0 unleveled. Decision: 1 fix, 1 accept, 0 defer, 0 undecided.
MD
mkdir -p "$R1/fixes/parts"
cat > "$R1/fixes/parts/03.md" <<'MD'
---
id: "03"
depends-on: []
isolation: shared
files:
  - src/parse.test.js
---

# Part 03: Test of an empty ledger file

## Goal

A test reads an empty ledger file.

## Acceptance scenarios

- None: the part adds a test of behaviour the code already has.

## Tasks

1. Test parseEntries on the empty string (fixes f-5e1b2c7d9a01)
   - File: src/parse.test.js
   - Interface: none
   - Verified by: src/parse.test.js; the new test passes at its first run
MD
cat > "$R1/fixes/index.md" <<'MD'
# Fix parts of round 1

- f-5e1b2c7d9a01: part 03

## Not planned
- None.
MD
printf 'Status: done\n\n## Blockers\n- None.\n' > "$R1/fixes/result.md"
cat >> src/parse.test.js <<'JS'

test("an empty ledger file has no entries", () => {
  assert.deepEqual(parseEntries(""), []);
});
JS
git add -A
git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "test(ledger): read an empty ledger file"
HEAD=$(git rev-parse HEAD)
mkdir -p "$R2"
: > "$R2/findings.jsonl"
cat > "$R2/groups.json" <<JSON
{"base":"main","anchor":{"kind":"round","sha":"$ROUND1_HEAD","round":1},"head":"$HEAD","range":"$ROUND1_HEAD..$HEAD","files":["src/parse.test.js"],"binary":[],"deleted":[],"dirty":[],"tests":["src/parse.test.js"],"testsOnly":true,"groups":[{"id":"p03","kind":"part","part":"03","files":["src/parse.test.js"]},{"id":"integration","kind":"integration","files":["src/parse.test.js"]}]}
JSON
