#!/usr/bin/env bash
# Round 1 of add-total planned: fix part 02 adds the missing test of "Empty ledger", a scenario
# whose behaviour the code already has, marked (behaviour present) as plan-fixes writes it.
set -euo pipefail
bash "$(dirname "$0")/../fixtures/tally-total-untested.sh"
FIXES=.bdk/runs/add-total/review/round-1/fixes
mkdir -p "$FIXES/parts"
cat > "$FIXES/parts/02.md" <<'MD'
---
id: "02"
depends-on: []
isolation: shared
files:
  - test/total.test.js
---

# Part 02: Fixes of review round 1 in test/total.test.js

## Goal

The scenario Empty ledger has a test.

## Acceptance scenarios

- `tally` / Requirement: Total / Scenario: Empty ledger (behaviour present)

## Tasks

1. Fix f-86d92ef246f3: add a test for the scenario Empty ledger
   - File: test/total.test.js
   - Interface: none
   - Verified by: tally / Requirement: Total / Scenario: Empty ledger; a test in test/total.test.js that runs `tally total` in an empty directory and expects `Total: 0.00`, exit 0; it passes at its first run, the behaviour is present
MD
cat > "$FIXES/index.md" <<'MD'
# Fixes of review round 1

## Parts
- 02: f-86d92ef246f3

## Not planned
- None.
MD
