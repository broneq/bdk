#!/usr/bin/env bash
# A configured BDK project: a Node CLI `ledger` on main, and the branch `monthly-report` with
# the Change of that name in two plan parts, then a recorded review round 1 (no findings yet).
# Seeded: part 01 parses "7" and "12.5" into the wrong number of cents (its tests use only two
# decimals); part 02 formats the cents of part 01 as dollars (its tests build dollar entries by
# hand), so `ledger report` prints 1250.00 for 12.50 while every test passes.
set -euo pipefail

export GIT_AUTHOR_DATE="2026-10-01T10:00:00Z" GIT_COMMITTER_DATE="2026-10-01T10:00:00Z"
commit() {
  git add -A
  git -c user.name="BDK eval" -c user.email="eval@example.invalid" commit --quiet -m "$1"
}

cat > package.json <<'JSON'
{
  "name": "ledger",
  "version": "1.0.0",
  "type": "module",
  "bin": { "ledger": "bin/ledger.js" },
  "scripts": { "test": "node --test" }
}
JSON

cat > .gitignore <<'TXT'
/.bdk/runs/
/.bdk/settings.local.yaml
TXT

mkdir -p .bdk openspec/specs/ledger bin src
cat > .bdk/settings.yaml <<'YAML'
# BDK project settings. Resolved values with their origins: bdk config show
languages: [javascript]
tools:
  test:
    - id: node-test
      command: npm test
      scoped: node --test {files}
YAML

cat > openspec/config.yaml <<'YAML'
schema: bdk
YAML

cat > openspec/specs/ledger/spec.md <<'MD'
# ledger Specification

## Purpose

The `ledger` command line tool reads a ledger file of `date,description,amount` lines.

## Requirements

### Requirement: Help

`ledger --help` SHALL print the usage and exit 0.

#### Scenario: Help

- **WHEN** `ledger --help` runs
- **THEN** it prints the usage and exits 0
MD

cat > bin/ledger.js <<'JS'
#!/usr/bin/env node
const [command] = process.argv.slice(2);
if (command === "--help" || command === undefined) {
  console.log("Usage: ledger <command> <file.csv>");
  process.exit(0);
}
console.error(`unknown command: ${command}`);
process.exit(2);
JS
chmod +x bin/ledger.js

cat > README.md <<'MD'
# ledger

Reads a ledger file of `date,description,amount` lines.
MD

git init --quiet --initial-branch=main
commit "feat: ledger cli"

git checkout --quiet -b monthly-report

CHANGE=openspec/changes/monthly-report
mkdir -p "$CHANGE/specs/ledger" "$CHANGE/plan/parts"
cat > "$CHANGE/.openspec.yaml" <<'YAML'
schema: bdk
YAML

cat > "$CHANGE/proposal.md" <<'MD'
# Proposal

## Why

Users want to see how much they spent each month without a spreadsheet.

## What Changes

- `ledger report <file>` prints the total of each month, in currency units with two decimals.

## Capabilities

### Modified Capabilities

- `ledger`: adds the monthly report.
MD

cat > "$CHANGE/specs/ledger/spec.md" <<'MD'
## ADDED Requirements

### Requirement: Entries

A ledger file SHALL hold one entry per line, `date,description,amount`, where `date` is `YYYY-MM-DD` and `amount` is a decimal number in currency units with zero, one or two decimal digits and an optional minus sign. An empty file SHALL hold no entries.

#### Scenario: Amounts with fewer decimals

- **WHEN** a file holds the amounts `7`, `12.5` and `-3.25`
- **THEN** they are read as 7.00, 12.50 and -3.25

### Requirement: Monthly report

`ledger report <file>` SHALL print one line per month that has entries, `YYYY-MM <total>`, in ascending month order, where `<total>` is the sum of the month's amounts in currency units with exactly two decimals.

#### Scenario: Totals per month

- **WHEN** the file holds `2026-01-05,rent,12.50`, `2026-01-20,coffee,2.25` and `2026-02-01,refund,-3`
- **THEN** `ledger report <file>` prints `2026-01 14.75` and `2026-02 -3.00`, and exits 0
MD

cat > "$CHANGE/design.md" <<'MD'
## Decisions

### D1. Amounts in integer cents

Entries carry `amount` in integer cents, so sums are exact. Only the report turns cents back into currency units with two decimals.
MD

cat > "$CHANGE/plan/parts/01.md" <<'MD'
---
id: "01"
depends-on: []
isolation: worktree
files:
  - src/parse.js
  - src/parse.test.js
---

# Part 01: Parse entries

## Goal

A ledger file is read into entries with amounts in integer cents.

## Acceptance scenarios

- `ledger` / Requirement: Entries / Scenario: Amounts with fewer decimals

## Tasks

1. Parse the lines of a ledger file
   - File: src/parse.js, src/parse.test.js
   - Interface: parseEntries(csv): { date, amount }[], amount in integer cents
   - Verified by: ledger / Requirement: Entries / Scenario: Amounts with fewer decimals; src/parse.test.js
MD

cat > "$CHANGE/plan/parts/02.md" <<'MD'
---
id: "02"
depends-on: ["01"]
isolation: worktree
files:
  - src/report.js
  - src/report.test.js
  - bin/ledger.js
---

# Part 02: Monthly report

## Goal

`ledger report <file>` prints the total of each month.

## Acceptance scenarios

- `ledger` / Requirement: Monthly report / Scenario: Totals per month

## Tasks

1. Sum the entries of each month
   - File: src/report.js, src/report.test.js
   - Interface: monthlyTotals(entries): { month, total }[], total as a string with two decimals
   - Verified by: src/report.test.js
2. Add the report command
   - File: bin/ledger.js
   - Interface: ledger report <file>
   - Verified by: ledger / Requirement: Monthly report / Scenario: Totals per month
MD
commit "docs: propose monthly-report"

cat > src/parse.js <<'JS'
/**
 * Reads the lines `date,description,amount` of a ledger file.
 * @param {string} csv
 * @returns {{ date: string, amount: number }[]} entries, `amount` in integer cents
 */
export function parseEntries(csv) {
  if (!csv.trim()) return [];
  return csv
    .trim()
    .split("\n")
    .map((line) => {
      const [date, , amt] = line.split(",");
      return { date, amount: Number(amt.replace(".", "")) };
    });
}
JS

cat > src/parse.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntries } from "./parse.js";

test("amounts are read in cents", () => {
  assert.deepEqual(parseEntries("2026-01-05,rent,12.50\n2026-01-06,fee,-3.25\n"), [
    { date: "2026-01-05", amount: 1250 },
    { date: "2026-01-06", amount: -325 },
  ]);
});

test("an empty file has no entries", () => {
  assert.deepEqual(parseEntries("\n"), []);
});
JS
commit "feat(ledger): parse entries in cents"

cat > src/report.js <<'JS'
/**
 * Sums the amounts of each month.
 * @param {{ date: string, amount: number }[]} entries
 * @returns {{ month: string, total: string }[]} months in ascending order
 */
export function monthlyTotals(entries) {
  const totals = new Map();
  for (const { date, amount } of entries) {
    const month = date.slice(0, 7);
    totals.set(month, (totals.get(month) ?? 0) + amount);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total: total.toFixed(2) }));
}
JS

cat > src/report.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyTotals } from "./report.js";

test("totals per month, in month order", () => {
  const entries = [
    { date: "2026-02-01", amount: -3 },
    { date: "2026-01-05", amount: 12.5 },
    { date: "2026-01-20", amount: 2.25 },
  ];
  assert.deepEqual(monthlyTotals(entries), [
    { month: "2026-01", total: "14.75" },
    { month: "2026-02", total: "-3.00" },
  ]);
});
JS

cat > bin/ledger.js <<'JS'
#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { parseEntries } from "../src/parse.js";
import { monthlyTotals } from "../src/report.js";

const [command, file] = process.argv.slice(2);
if (command === "--help" || command === undefined) {
  console.log("Usage: ledger <command> <file.csv>\n\nCommands:\n  report  totals per month");
  process.exit(0);
}
if (command === "report") {
  for (const { month, total } of monthlyTotals(parseEntries(readFileSync(file, "utf8")))) {
    console.log(`${month} ${total}`);
  }
} else {
  console.error(`unknown command: ${command}`);
  process.exit(2);
}
JS
commit "feat(ledger): monthly report command"

# Round 1 as `bdk git groups main --plan openspec/changes/monthly-report/plan/parts
# --record .bdk/runs/monthly-report/review/round-1` records it.
ROUND=.bdk/runs/monthly-report/review/round-1
BASE=$(git rev-parse main)
HEAD=$(git rev-parse HEAD)
mkdir -p "$ROUND"
cat > "$ROUND/groups.json" <<JSON
{"base":"main","anchor":{"kind":"base","sha":"$BASE"},"head":"$HEAD","range":"$BASE..$HEAD","files":["bin/ledger.js","openspec/changes/monthly-report/.openspec.yaml","openspec/changes/monthly-report/design.md","openspec/changes/monthly-report/plan/parts/01.md","openspec/changes/monthly-report/plan/parts/02.md","openspec/changes/monthly-report/proposal.md","openspec/changes/monthly-report/specs/ledger/spec.md","src/parse.js","src/parse.test.js","src/report.js","src/report.test.js"],"binary":[],"deleted":[],"dirty":[],"groups":[{"id":"p01","kind":"part","part":"01","files":["src/parse.js","src/parse.test.js"]},{"id":"p02","kind":"part","part":"02","files":["bin/ledger.js","src/report.js","src/report.test.js"]},{"id":"unplanned","kind":"unplanned","files":["openspec/changes/monthly-report/.openspec.yaml","openspec/changes/monthly-report/design.md","openspec/changes/monthly-report/plan/parts/01.md","openspec/changes/monthly-report/plan/parts/02.md","openspec/changes/monthly-report/proposal.md","openspec/changes/monthly-report/specs/ledger/spec.md"]},{"id":"integration","kind":"integration","files":["bin/ledger.js","openspec/changes/monthly-report/.openspec.yaml","openspec/changes/monthly-report/design.md","openspec/changes/monthly-report/plan/parts/01.md","openspec/changes/monthly-report/plan/parts/02.md","openspec/changes/monthly-report/proposal.md","openspec/changes/monthly-report/specs/ledger/spec.md","src/parse.js","src/parse.test.js","src/report.js","src/report.test.js"]}]}
JSON
