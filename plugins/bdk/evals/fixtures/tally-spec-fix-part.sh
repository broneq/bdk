#!/usr/bin/env bash
# tally-ledger-path.sh plus round 1 of add-total triaged and planned: the spec-conformance finding
# that no delta lists the bad-amount error is a blocker decided fix, and fix part 01 adds it to the
# delta with its scenario, a part that changes spec text only (its checks are `openspec validate --strict`
# and the next round's spec conformance).
set -euo pipefail
bash "$(dirname "$0")/tally-ledger-path.sh"
round=.bdk/runs/add-total/review/round-1
cat > "$round/findings.jsonl" <<'JSONL'
{"type":"finding","id":"f-4b2e91c07a35","source":"spec-conformance","summary":"No spec delta lists the error tally add prints for a bad amount","file":"openspec/changes/add-total/specs/tally/spec.md","line":1,"evidence":"tally add abc prints `tally: not an amount: abc` to stderr and exits 1 (bin/tally.js:19-20); no requirement of the delta or of the main spec tally describes it. The proposal asks for this one-line error, so the delta is the side that is missing it."}
{"type":"level","id":"f-4b2e91c07a35","level":"blocker","reason":"The deltas would not describe the product after archive: close refuses it."}
{"type":"decision","id":"f-4b2e91c07a35","decision":"fix","reason":"policy.gates.review auto: blocker"}
JSONL
mkdir -p "$round/fixes/parts"
cat > "$round/fixes/parts/01.md" <<'MD'
---
id: "01"
depends-on: []
isolation: shared
files:
  - openspec/changes/add-total/specs/tally/spec.md
---

# Part 01: Fixes of review round 1 in the tally spec delta

## Goal

The spec delta of `tally` describes the error `tally add` prints for an amount that is not a number, as the proposal asks.

## Acceptance scenarios

- None.

## Tasks

1. Fix f-4b2e91c07a35: add the requirement Bad amount under `## ADDED Requirements` of the `tally` delta (`tally add` with an amount that is not a number prints `tally: not an amount: <text>` to stderr, exits 1 and leaves the ledger unchanged), with `#### Scenario: Amount that is not a number`: WHEN `tally add abc` runs, THEN it prints `tally: not an amount: abc` to stderr, exits 1 and the ledger is unchanged
   - File: openspec/changes/add-total/specs/tally/spec.md
   - Interface: none
   - Verified by: `openspec validate add-total --strict` passes; the spec check of the next review round
MD
cat > "$round/fixes/index.md" <<'MD'
# Fixes of round 1

- f-4b2e91c07a35: part 01

## Not planned

- None.
MD
