#!/usr/bin/env bash
# Shared fixture: tally-reviewed.sh whose review round 1 ran E2E with one failed path the round's
# judge cleared (#396). The E2E tester failed `see-the-total--empty-ledger.md` with an observation
# the code does not give (exit 1, `tally: no ledger here`; bin/tally.js prints `Total: 0.00`
# without a ledger), logged it as an e2e-check finding, and the judge levelled it
# `not-a-problem`; triage accepted it and the review ended `done`. So the latest E2E verdict reads
# `Verdict: FAIL`, and close must not refuse the Change on it. See ../README.md, "Shared fixtures".
set -euo pipefail
bash "$(dirname "$0")/tally-reviewed.sh"

round=.bdk/runs/add-total/review/round-1
cat > "$round/e2e/verdict.md" <<'MD'
Verdict: FAIL

## see-the-total
- pass: main (main, proposal.md:7) - see-the-total--main.md
- fail: empty-ledger (variant, proposal.md:7) - see-the-total--empty-ledger.md
- pass: repeated-total (break, proposal.md:7) - see-the-total--repeated-total.md

## read-the-usage
- pass: main (main, proposal.md:8) - read-the-usage--main.md
- pass: unknown-command (break, proposal.md:8) - read-the-usage--unknown-command.md

## Not a user process
- None.
MD

cat > "$round/e2e/see-the-total--empty-ledger.md" <<'MD'
Result: fail
Process: see-the-total
Path: empty-ledger (variant)
Proposal: openspec/changes/add-total/proposal.md:7 - New command `tally total`.
Item: cli (cli)

## Steps
1. `node /work/tally/bin/tally.js total` in a fresh directory -> exit 1, stderr `tally: no ledger here`

## Expected
`Total: 0.00`, exit 0
Expected from: openspec/changes/add-total/specs/tally/spec.md:12

## Observed
exit 1, stderr `tally: no ledger here`
MD

cat > "$round/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-4d2e8a1c7b90","source":"e2e-check","summary":"see-the-total / empty-ledger: tally total exits 1 with `tally: no ledger here` in a fresh directory","file":"openspec/changes/add-total/proposal.md","line":7,"evidence":".bdk/runs/add-total/review/round-1/e2e/see-the-total--empty-ledger.md: expected `Total: 0.00`, exit 0 (specs/tally/spec.md:12); observed exit 1, stderr `tally: no ledger here`"}
{"type":"level","id":"f-4d2e8a1c7b90","level":"not-a-problem","reason":"The observation does not hold: load() at bin/tally.js:10 returns [] when ledger.json is missing, so total prints `Total: 0.00` and exits 0; no code prints `tally: no ledger here`."}
{"type":"decision","id":"f-4d2e8a1c7b90","decision":"accept","reason":"not-a-problem: nothing to fix."}
JSONL

cat > "$round/review.md" <<'MD'
# Review round 1: add-total

No blockers. 1 finding (1 not-a-problem).
MD

cat > .bdk/runs/add-total/review/result.md <<'MD'
Status: done

## Rounds
- 1: 1 finding (1 not-a-problem)

## Deferred
- None.

## Blockers
- None.

## Decisions taken without the user
- Round 1: triage by policy.gates.review auto.
MD
