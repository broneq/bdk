#!/usr/bin/env bash
# Shared fixture: tiny-ledger configured for BDK with the Change add-totals planned and
# verified - two worktree parts in one wave that both add a function at the end of
# src/ledger.js, so merging the second one conflicts - written into the current directory.
# The execute and resolve-conflict cases start here. See ../README.md, "Shared fixtures".
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tiny-ledger-bdk.sh"

# The execute lead commits and merges; a run has no global git identity.
git config user.name "BDK eval"
git config user.email "eval@example.invalid"

change=openspec/changes/add-totals
mkdir -p "$change/specs/ledger" "$change/plan/parts"
cat > "$change/.openspec.yaml" <<'YAML'
schema: bdk
created: 2026-10-08
YAML

cat > "$change/proposal.md" <<'MD'
# Proposal

## Why

Users see one balance, but want to know how much came in and how much went out.

## What Changes

- `income(entries)`: the sum of the income amounts.
- `expenses(entries)`: the sum of the expense amounts, as a positive number.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ledger`: income and expense totals.

## Impact

- `src/ledger.js` gains two exported functions, each with its own test file.
MD

cat > "$change/specs/ledger/spec.md" <<'MD'
## ADDED Requirements

### Requirement: Income total

`income(entries)` SHALL return the sum of the positive amounts of the entries, and 0 when there is none.

#### Scenario: Income of mixed entries

- **WHEN** `income` is called with entries of amount 5, -2 and 3
- **THEN** it returns 8

#### Scenario: No income

- **WHEN** `income` is called with an empty list
- **THEN** it returns 0

### Requirement: Expense total

`expenses(entries)` SHALL return the sum of the negative amounts of the entries as a positive number, and 0 when there is none.

#### Scenario: Expenses of mixed entries

- **WHEN** `expenses` is called with entries of amount 5, -2 and -7
- **THEN** it returns 9

#### Scenario: No expenses

- **WHEN** `expenses` is called with entries of amount 5 and 3
- **THEN** it returns 0
MD

cat > "$change/design.md" <<'MD'
# Design

## Context

`src/ledger.js` exports `balance(entries)`, the sum of `entry.amount`. Tests use `node:test` (`npm test` runs `node --test`).

## Decisions

### D1. Two functions next to `balance`

`income(entries)` and `expenses(entries)` are exported from `src/ledger.js` after `balance`, each a `reduce` over the entries like `balance`. Each has its own test file, `src/income.test.js` and `src/expenses.test.js`, so the two parts touch only one shared file.

Alternative: a new module `src/totals.js` - lost, the totals belong with `balance`.

## Risks / Trade-offs

- [Both parts change `src/ledger.js`] -> both append after `balance`; the execute lead merges them in part order.
MD

cat > "$change/plan/parts/01.md" <<'MD'
---
id: "01"
depends-on: []
isolation: worktree
files:
  - src/ledger.js
  - src/income.test.js
---

# Part 01: Income total

## Goal

`income(entries)` in `src/ledger.js` returns the sum of the positive amounts.

## Acceptance scenarios

- `ledger` / Requirement: Income total / Scenario: Income of mixed entries
- `ledger` / Requirement: Income total / Scenario: No income

## Tasks

1. Add `income` after `balance`, at the end of `src/ledger.js`
   - File: src/ledger.js, src/income.test.js
   - Interface: income(entries: { amount: number }[]): number, exported from src/ledger.js
   - Verified by: ledger / Requirement: Income total / Scenario: Income of mixed entries, Scenario: No income; src/income.test.js
MD

cat > "$change/plan/parts/02.md" <<'MD'
---
id: "02"
depends-on: []
isolation: worktree
files:
  - src/ledger.js
  - src/expenses.test.js
---

# Part 02: Expense total

## Goal

`expenses(entries)` in `src/ledger.js` returns the sum of the negative amounts as a positive number.

## Acceptance scenarios

- `ledger` / Requirement: Expense total / Scenario: Expenses of mixed entries
- `ledger` / Requirement: Expense total / Scenario: No expenses

## Tasks

1. Add `expenses` after `balance`, at the end of `src/ledger.js`, returning the sum of the negative amounts negated
   - File: src/ledger.js, src/expenses.test.js
   - Interface: expenses(entries: { amount: number }[]): number, exported from src/ledger.js
   - Verified by: ledger / Requirement: Expense total / Scenario: Expenses of mixed entries, Scenario: No expenses; src/expenses.test.js
MD

git add .
git commit --quiet -m "docs: plan add-totals"

# The plan stage's verdict lives in the run directory, outside git.
mkdir -p .bdk/runs/add-totals/plan
cat > .bdk/runs/add-totals/plan/verify-1.md <<'MD'
Verdict: PASS

## Must address
- None.
MD
