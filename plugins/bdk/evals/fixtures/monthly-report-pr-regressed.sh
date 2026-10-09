#!/usr/bin/env bash
# Shared fixture: monthly-report-pr-reviewed.sh plus a second answer of the author. The new head
# commit fixes the report blocker of review 1 (the report now turns cents into currency units),
# but its rewrite of monthlyTotals keeps only the last entry of each month instead of adding
# them, and its rewritten test has one entry per month. So both threads of review 1 are fixed,
# every test passes, and the scenario "Totals per month" prints `2026-01 2.25` instead of
# `2026-01 14.75`: a new blocker in the commits since the review. See ../README.md, "Shared
# fixtures".
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
bash "$here/monthly-report-pr-reviewed.sh"

export GIT_AUTHOR_DATE="2026-10-03T10:00:00Z" GIT_COMMITTER_DATE="2026-10-03T10:00:00Z"
git checkout --quiet --detach "$(git rev-parse origin/monthly-report)"
cat > src/report.js <<'JS'
/**
 * Sums the amounts of each month.
 * @param {{ date: string, amount: number }[]} entries, `amount` in integer cents
 * @returns {{ month: string, total: string }[]} months in ascending order, totals in currency units
 */
export function monthlyTotals(entries) {
  const totals = new Map();
  for (const { date, amount } of entries) {
    totals.set(date.slice(0, 7), amount);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cents]) => ({ month, total: (cents / 100).toFixed(2) }));
}
JS
cat > src/report.test.js <<'JS'
import { test } from "node:test";
import assert from "node:assert/strict";
import { monthlyTotals } from "./report.js";

test("totals per month in currency units, in month order", () => {
  const entries = [
    { date: "2026-02-01", amount: -300 },
    { date: "2026-01-05", amount: 1250 },
  ];
  assert.deepEqual(monthlyTotals(entries), [
    { month: "2026-01", total: "12.50" },
    { month: "2026-02", total: "-3.00" },
  ]);
});
JS
git add -A
git -c user.name="Teammate" -c user.email="teammate@example.invalid" commit --quiet \
  -m "fix(report): print totals in currency units"
head=$(git rev-parse HEAD)
git push --quiet --force origin HEAD:monthly-report HEAD:refs/pull/7/head
git checkout --quiet main
git fetch --quiet origin

node -e '
const fs = require("fs");
const file = ".git/bdk-eval/prs/7.json";
const pr = JSON.parse(fs.readFileSync(file, "utf8"));
pr.headRefOid = process.argv[1];
fs.writeFileSync(file, JSON.stringify(pr, null, 2) + "\n");
' "$head"
