#!/usr/bin/env bash
# Shared fixture: ledger-planned.sh with part 01 of add-csv-export built and
# left uncommitted, as the execute lead hands it to conform-part, and the
# implementer's report in the run directory. A case's scaffold edits the code
# to hold what it tests. See ../README.md, "Shared fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/ledger-planned.sh"

cat > src/csv.js <<'JS'
import { balance } from "./ledger.js";

export function toCsv(entries) {
  const lines = ["date,description,amount"];
  for (const entry of entries) {
    lines.push(`${entry.date},${quote(entry.description)},${formatCents(entry.amount)}`);
  }
  lines.push(`,total,${formatCents(balance(entries))}`);
  return lines.map((line) => `${line}\n`).join("");
}

function quote(text) {
  if (!/[",]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatCents(cents) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const units = Math.trunc(absolute / 100);
  const rest = String(absolute % 100).padStart(2, "0");
  return `${sign}${units}.${rest}`;
}
JS

cat > src/csv.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv.js";

test("no entries gives the header and a zero total", () => {
  assert.equal(toCsv([]), "date,description,amount\n,total,0.00\n");
});

test("amounts in cents are written as decimal units", () => {
  const lines = toCsv([{ date: "2026-01-02", description: "Rent", amount: -120000 }]).split("\n");
  assert.equal(lines[1], "2026-01-02,Rent,-1200.00");
});

test("a description with a comma is quoted", () => {
  const lines = toCsv([{ date: "2026-01-03", description: "Coffee, beans", amount: -450 }]).split("\n");
  assert.equal(lines[1], '2026-01-03,"Coffee, beans",-4.50');
});

test("the last line is the total", () => {
  const csv = toCsv([
    { date: "2026-01-04", description: "Salary", amount: 500 },
    { date: "2026-01-05", description: "Tea", amount: -200 },
  ]);
  assert.equal(csv.trimEnd().split("\n").at(-1), ",total,3.00");
});
JS

run=.bdk/runs/add-csv-export
mkdir -p "$run/execute"
cat > "$run/execute/part-01.md" <<'MD'
Status: done

## Acceptance tests
- ledger-export / CSV text / No entries -> src/csv.test.js "no entries gives the header and a zero total"; red seen; green seen
- ledger-export / CSV text / Amount in cents -> src/csv.test.js "amounts in cents are written as decimal units"; red seen; green seen
- ledger-export / CSV text / Description with a comma -> src/csv.test.js "a description with a comma is quoted"; red seen; green seen
- ledger-export / CSV text / Total line -> src/csv.test.js "the last line is the total"; red seen; green seen

## Changed files
- src/csv.js
- src/csv.test.js

## Checks
- checks/01-red.json: fail
- checks/01.json: pass

## Decisions taken without the user
- None.
MD
