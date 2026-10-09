#!/usr/bin/env bash
# Shared fixture: tiny-ledger configured for BDK with the Change dated-entries planned and
# verified - two parts in one wave, on different files, that each pass alone and fail together:
# part 01 makes balance() reject an entry without a date, part 02 adds src/report.js whose test
# builds entries without one. Nothing in part 02 names a date, so neither part can see the
# other's effect; only the wave check does. Written into the current directory. The wave check
# cases start here. See ../README.md, "Shared fixtures".
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/tiny-ledger-bdk.sh"

# The execute lead commits and merges; a run has no global git identity.
git config user.name "BDK eval"
git config user.email "eval@example.invalid"

change=openspec/changes/dated-entries
mkdir -p "$change/specs/ledger" "$change/specs/report" "$change/plan/parts"
cat > "$change/.openspec.yaml" <<'YAML'
schema: bdk
created: 2026-10-09
YAML

cat > "$change/proposal.md" <<'MD'
# Proposal

## Why

Entries are copied from bank statements, and an entry typed without its date cannot be matched to the statement later. Users also want a one-line summary to print under a statement.

## What Changes

- Every entry holds a `date`; `balance(entries)` rejects an entry without one.
- `summary(entries)` in a new `src/report.js` returns the line `Balance: <n>`.

## Capabilities

### New Capabilities

- `report`: the summary line.

### Modified Capabilities

- `ledger`: an entry holds a date.

## Impact

- `src/ledger.js` and its test; a new `src/report.js` with its test.
MD

cat > "$change/specs/ledger/spec.md" <<'MD'
## MODIFIED Requirements

### Requirement: Entries

An entry SHALL hold a numeric `amount`, positive for income and negative for an expense, and a `date` in the form `YYYY-MM-DD`. `balance(entries)` SHALL throw a `TypeError` naming the position of the first entry without a `date`.

#### Scenario: Expense entry

- **WHEN** an expense of 2 is recorded on 2026-10-01
- **THEN** the ledger holds an entry with `amount` -2 and `date` `2026-10-01`

#### Scenario: Entry without a date

- **WHEN** `balance` is called with an entry of amount 5 and no `date`
- **THEN** it throws a `TypeError` naming entry 1
MD

cat > "$change/specs/report/spec.md" <<'MD'
## ADDED Requirements

### Requirement: Summary line

`summary(entries)` in `src/report.js` SHALL return `Balance: ` followed by the balance of the entries.

#### Scenario: Summary of income and an expense

- **WHEN** `summary` is called with entries of amount 5 and -2
- **THEN** it returns `Balance: 3`
MD

cat > "$change/design.md" <<'MD'
# Design

## Context

`src/ledger.js` exports `balance(entries)`, the sum of `entry.amount`. Tests use `node:test` (`npm test` runs `node --test`).

## Decisions

### D1. Check the date in balance

`balance` checks every entry before it sums, so no caller can sum an undated entry. A date is a string; its form is not checked yet.

### D2. Summary in its own module

`src/report.js` exports `summary(entries)`, built on `balance` from `src/ledger.js`, with its test `src/report.test.js`.

## Risks / Trade-offs

- [An entry without a date now throws] -> the ledger keeps entries only in memory, so no saved book has undated entries.
MD

cat > "$change/plan/parts/01.md" <<'MD'
---
id: "01"
depends-on: []
isolation: worktree
files:
  - src/ledger.js
  - src/ledger.test.js
---

# Part 01: Dated entries

## Goal

`balance(entries)` throws a `TypeError` for an entry without a `date`.

## Acceptance scenarios

- `ledger` / Requirement: Entries / Scenario: Entry without a date

## Tasks

1. Check every entry's `date` in `balance`, and date the entries of its test
   - File: src/ledger.js, src/ledger.test.js
   - Interface: balance(entries: { amount: number, date: string }[]): number, throws TypeError("entry <n> has no date")
   - Verified by: ledger / Requirement: Entries / Scenario: Entry without a date; src/ledger.test.js
MD

cat > "$change/plan/parts/02.md" <<'MD'
---
id: "02"
depends-on: []
isolation: worktree
files:
  - src/report.js
  - src/report.test.js
---

# Part 02: Summary line

## Goal

`summary(entries)` in `src/report.js` returns `Balance: <n>`.

## Acceptance scenarios

- `report` / Requirement: Summary line / Scenario: Summary of income and an expense

## Tasks

1. Add `summary` in a new `src/report.js`, built on `balance` from `src/ledger.js`
   - File: src/report.js, src/report.test.js
   - Interface: summary(entries: { amount: number }[]): string, exported from src/report.js
   - Verified by: report / Requirement: Summary line / Scenario: Summary of income and an expense; src/report.test.js
MD

git add .
git commit --quiet -m "docs: plan dated-entries"

mkdir -p .bdk/runs/dated-entries/plan
cat > .bdk/runs/dated-entries/plan/verify-1.md <<'MD'
Verdict: PASS

## Must address
- None.
MD
