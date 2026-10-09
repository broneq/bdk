#!/usr/bin/env bash
# Shared fixture: ledger-totals-planned.sh plus part 03, which depends on parts 01 and 02,
# so the waves are 1: 01 02 and 2: 03. Every part says `isolation: worktree`; part 03 is
# alone in its wave. The execute-single-part-wave and execute-resume-* cases start here.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-totals-planned.sh"

change=openspec/changes/add-totals
cat >> "$change/specs/ledger/spec.md" <<'MD'

### Requirement: Totals summary

`summary(entries)` SHALL return an object with the keys `income`, `expenses` and `balance`, holding what `income`, `expenses` and `balance` return for the entries.

#### Scenario: Summary of mixed entries

- **WHEN** `summary` is called with entries of amount 5, -2 and 3
- **THEN** it returns `{ income: 8, expenses: 2, balance: 6 }`
MD

cat >> "$change/proposal.md" <<'MD'
- `summary(entries)`: the three totals in one object, built on `income`, `expenses` and `balance`.
MD

cat > "$change/plan/parts/03.md" <<'MD'
---
id: "03"
depends-on: ["01", "02"]
isolation: worktree
files:
  - src/ledger.js
  - src/summary.test.js
---

# Part 03: Totals summary

## Goal

`summary(entries)` in `src/ledger.js` returns `{ income, expenses, balance }` from the three functions.

## Acceptance scenarios

- `ledger` / Requirement: Totals summary / Scenario: Summary of mixed entries

## Tasks

1. Add `summary` at the end of `src/ledger.js`, calling `income`, `expenses` and `balance`
   - File: src/ledger.js, src/summary.test.js
   - Interface: summary(entries: { amount: number }[]): { income: number, expenses: number, balance: number }, exported from src/ledger.js
   - Verified by: ledger / Requirement: Totals summary / Scenario: Summary of mixed entries; src/summary.test.js
MD

git add .
git commit --quiet -m "docs: plan the totals summary"
